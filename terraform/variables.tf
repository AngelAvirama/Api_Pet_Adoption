
variable "aws_region" {
  description = "AWS region for the infrastructure"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name used to identify AWS resources"
  type        = string
  default     = "pet-adoption"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "demo"
}

variable "api_port" {
  description = "Port used by the Express API"
  type        = number
  default     = 3000
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "pet_adoption"
}

variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
  default     = "pet_adoption_admin"
}

variable "db_password" {
  description = "PostgreSQL master password"
  type        = string
  sensitive   = true
}

variable "image_tag" {
  description = "Immutable tag of the API image in ECR"
  type        = string
  default     = "initial"
}

variable "api_desired_count" {
  description = "Number of API tasks to run"
  type        = number
  default     = 0
}