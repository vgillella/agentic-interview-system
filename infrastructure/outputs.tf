output "backend_url" {
  description = "Backend ALB DNS — use as VITE_API_BASE_URL"
  value       = "http://${aws_lb.backend.dns_name}"
}

output "frontend_url" {
  description = "CloudFront URL for the React app"
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "ecr_repo_url" {
  description = "ECR repository URL — use as BACKEND_ECR_REPO GitHub secret"
  value       = aws_ecr_repository.backend.repository_url
}

output "s3_bucket_name" {
  description = "S3 bucket name — use as S3_BUCKET GitHub secret"
  value       = aws_s3_bucket.frontend.id
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID — use as CLOUDFRONT_DISTRIBUTION_ID GitHub secret"
  value       = aws_cloudfront_distribution.frontend.id
}

output "github_actions_role_arn" {
  description = "IAM role ARN used by GitHub Actions OIDC"
  value       = aws_iam_role.github_actions_deploy.arn
}
