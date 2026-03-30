terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  # Store state remotely (optional — uncomment after creating the S3 bucket manually)
  # backend "s3" {
  #   bucket = "your-terraform-state-bucket"
  #   key    = "interview-agent/terraform.tfstate"
  #   region = "us-east-1"
  # }
}

provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "current" {}

locals {
  app = "interview-agent"
}

# ── ECR Repository ─────────────────────────────────────────────────────────────
resource "aws_ecr_repository" "backend" {
  name                 = "${local.app}-backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

# ── S3 Bucket (frontend) ───────────────────────────────────────────────────────
resource "aws_s3_bucket" "frontend" {
  bucket = "${local.app}-frontend-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket                  = aws_s3_bucket.frontend.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ── CloudFront OAC + Distribution ─────────────────────────────────────────────
resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${local.app}-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100"

  # Origin 1: S3 static frontend
  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "s3-frontend"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  # Origin 2: FastAPI backend via ALB — extended timeout for GPT-5.4 PDF parsing
  origin {
    domain_name = aws_lb.backend.dns_name
    origin_id   = "alb-backend"

    custom_origin_config {
      http_port                = 80
      https_port               = 443
      origin_protocol_policy   = "http-only"
      origin_ssl_protocols     = ["TLSv1.2"]
      origin_read_timeout      = 60    # CloudFront maximum allowed value
      origin_keepalive_timeout = 60
    }
  }

  # /api/* → backend ALB (no caching, pass all headers/methods)
  ordered_cache_behavior {
    path_pattern           = "/api/*"
    target_origin_id       = "alb-backend"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = true
      headers      = ["*"]
      cookies {
        forward = "all"
      }
    }

    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 0
  }

  # Default: S3 static assets
  default_cache_behavior {
    target_origin_id       = "s3-frontend"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  # SPA fallback — serve index.html for all 404s
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
  }
  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

# S3 bucket policy — allow CloudFront OAC only
resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.frontend.arn}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.frontend.arn
        }
      }
    }]
  })
}

# ── SSM Parameters (secrets — values set manually, never in Terraform) ─────────
resource "aws_ssm_parameter" "openai_key" {
  name  = "/${local.app}/OPENAI_API_KEY"
  type  = "SecureString"
  value = "REPLACE_ME"   # Set via: aws ssm put-parameter --name /interview-agent/OPENAI_API_KEY --value "sk-..." --type SecureString --overwrite
  lifecycle { ignore_changes = [value] }
}

resource "aws_ssm_parameter" "elevenlabs_key" {
  name  = "/${local.app}/ELEVENLABS_API_KEY"
  type  = "SecureString"
  value = "REPLACE_ME"
  lifecycle { ignore_changes = [value] }
}

resource "aws_ssm_parameter" "elevenlabs_voice_id" {
  name  = "/${local.app}/ELEVENLABS_VOICE_ID"
  type  = "String"
  value = "WRTiUEhnYuLOuf6I0PHk"
}

resource "aws_ssm_parameter" "supabase_url" {
  name  = "/${local.app}/SUPABASE_URL"
  type  = "String"
  value = "REPLACE_ME"
  lifecycle { ignore_changes = [value] }
}

resource "aws_ssm_parameter" "supabase_service_key" {
  name  = "/${local.app}/SUPABASE_SERVICE_KEY"
  type  = "SecureString"
  value = "REPLACE_ME"
  lifecycle { ignore_changes = [value] }
}

# ── ECS Cluster ────────────────────────────────────────────────────────────────
resource "aws_ecs_cluster" "main" {
  name = "${local.app}-cluster"
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${local.app}-backend"
  retention_in_days = 14
}

# ── IAM — ECS Task Execution Role ─────────────────────────────────────────────
resource "aws_iam_role" "ecs_task_execution" {
  name = "${local.app}-ecs-execution"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "ecs-tasks.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_ssm_read" {
  name = "ssm-read-secrets"
  role = aws_iam_role.ecs_task_execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ssm:GetParameters", "ssm:GetParameter"]
      Resource = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${local.app}/*"
    }]
  })
}

# ── ECS Task Definition ────────────────────────────────────────────────────────
resource "aws_ecs_task_definition" "backend" {
  family                   = "${local.app}-backend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn

  container_definitions = jsonencode([{
    name      = "backend"
    image     = "${aws_ecr_repository.backend.repository_url}:latest"
    essential = true
    portMappings = [{ containerPort = 8000, protocol = "tcp" }]

    secrets = [
      { name = "OPENAI_API_KEY",     valueFrom = aws_ssm_parameter.openai_key.arn },
      { name = "ELEVENLABS_API_KEY", valueFrom = aws_ssm_parameter.elevenlabs_key.arn },
      { name = "ELEVENLABS_VOICE_ID",valueFrom = aws_ssm_parameter.elevenlabs_voice_id.arn },
      { name = "SUPABASE_URL",       valueFrom = aws_ssm_parameter.supabase_url.arn },
      { name = "SUPABASE_SERVICE_KEY",valueFrom = aws_ssm_parameter.supabase_service_key.arn },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.backend.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }

    healthCheck = {
      command     = ["CMD-SHELL", "curl -f http://localhost:8000/health || exit 1"]
      interval    = 30
      timeout     = 10
      retries     = 5
      startPeriod = 120
    }
  }])
}

# ── ALB + ECS Service ──────────────────────────────────────────────────────────
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

resource "aws_security_group" "alb" {
  name   = "${local.app}-alb-sg"
  vpc_id = data.aws_vpc.default.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "backend" {
  name   = "${local.app}-backend-sg"
  vpc_id = data.aws_vpc.default.id

  ingress {
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_lb" "backend" {
  name               = "${local.app}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = data.aws_subnets.default.ids
}

resource "aws_lb_target_group" "backend" {
  name        = "${local.app}-tg"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = data.aws_vpc.default.id
  target_type = "ip"
  health_check {
    path                = "/health"
    interval            = 30
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.backend.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
}

resource "aws_ecs_service" "backend" {
  name            = "${local.app}-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = data.aws_subnets.default.ids
    security_groups  = [aws_security_group.backend.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 8000
  }

  depends_on = [aws_lb_listener.http]
}

# ── IAM OIDC — GitHub Actions deploy role (no static keys) ────────────────────
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

resource "aws_iam_role" "github_actions_deploy" {
  name = "github-actions-deploy"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringLike   = { "token.actions.githubusercontent.com:sub" = "repo:${var.github_repo}:ref:refs/heads/main" }
        StringEquals = { "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com" }
      }
    }]
  })
}

resource "aws_iam_role_policy" "github_deploy_policy" {
  name = "deploy-policy"
  role = aws_iam_role.github_actions_deploy.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ECRAuth"
        Effect = "Allow"
        Action = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Sid    = "ECRPush"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability", "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage", "ecr:InitiateLayerUpload", "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload", "ecr:PutImage"
        ]
        Resource = aws_ecr_repository.backend.arn
      },
      {
        Sid    = "ECSDeployment"
        Effect = "Allow"
        Action = ["ecs:UpdateService", "ecs:DescribeServices", "ecs:DescribeTaskDefinition", "iam:PassRole"]
        Resource = [
          aws_ecs_service.backend.id,
          aws_iam_role.ecs_task_execution.arn,
        ]
      },
      {
        Sid    = "ECSWait"
        Effect = "Allow"
        Action = ["ecs:DescribeServices"]
        Resource = "*"
      },
      {
        Sid    = "S3Frontend"
        Effect = "Allow"
        Action = ["s3:PutObject", "s3:DeleteObject", "s3:ListBucket", "s3:GetObject"]
        Resource = [aws_s3_bucket.frontend.arn, "${aws_s3_bucket.frontend.arn}/*"]
      },
      {
        Sid      = "CloudFrontInvalidation"
        Effect   = "Allow"
        Action   = ["cloudfront:CreateInvalidation"]
        Resource = "arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/${aws_cloudfront_distribution.frontend.id}"
      }
    ]
  })
}
