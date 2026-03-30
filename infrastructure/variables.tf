variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "github_repo" {
  description = "GitHub repo in owner/repo format — used to scope OIDC trust"
  type        = string
  default     = "vgillella/agentic-interview-system"
}
