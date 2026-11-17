
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

variable "stable_image_tag" {
  description = "Immutable image tag for the stable API"
  type        = string
  default     = "v3.0.1"
}

variable "canary_image_tag" {
  description = "Immutable image tag for the canary API"
  type        = string
  default     = "v4.0.1"
}

variable "stable_desired_count" {
  description = "Number of stable API tasks"
  type        = number
  default     = 0
}

variable "canary_desired_count" {
  description = "Number of canary API tasks"
  type        = number
  default     = 0
}

variable "canary_traffic_weight" {
  description = "Percentage weight assigned to canary traffic"
  type        = number
  default     = 0

  validation {
    condition     = var.canary_traffic_weight >= 0 && var.canary_traffic_weight <= 100
    error_message = "Canary traffic weight must be between 0 and 100."
  }
}

variable "canary_allowed_cidr" {
  description = "Public IP allowed to access the internal canary route"
  type        = string
  default     = "127.0.0.1/32"
}

# Release 5: Chaos Engineering

variable "resilience_enabled" {
  description = "Round of the experiment: false = round 0 (no protections), true = round 1"
  type        = bool
  default     = false
}

variable "chaos_enabled" {
  description = "Expose the chaos switch (/internal/chaos) in the API"
  type        = bool
  default     = true
}

variable "chaos_token" {
  description = "Token of the chaos switch (min 16 characters)"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.chaos_token) >= 16
    error_message = "chaos_token must have at least 16 characters."
  }
}

variable "otel_exporter_endpoint" {
  description = "OTLP endpoint of Grafana Cloud"
  type        = string
  default     = "https://otlp-gateway-prod-us-east-3.grafana.net/otlp"
}

variable "otel_exporter_headers" {
  description = "OTLP headers for Grafana Cloud, e.g. Authorization=Basic <base64 instance:token>"
  type        = string
  sensitive   = true
  default     = "none"
}

# Security game day (defense in depth), experiment 2

variable "security_hardening_enabled" {
  description = "Round of the security game day: false = round 0 (controls as before), true = round 1 (detection, containment and egress filtering)"
  type        = bool
  default     = false
}

variable "alert_email" {
  description = "E-mail that receives the security alerts (SNS); empty = no subscription"
  type        = string
  default     = ""
}
