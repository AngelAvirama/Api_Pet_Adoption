
output "aws_region" {
  description = "AWS region selected for deployment"
  value       = var.aws_region
}

output "project_name" {
  description = "Project name"
  value       = var.project_name
}

output "environment" {
  description = "Deployment environment"
  value       = var.environment
}

output "ecr_repository_url" {
  description = "URL of the API container repository"
  value       = aws_ecr_repository.api.repository_url
}