
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "Api_Pet_Adoption"
      ManagedBy   = "Terraform"
      Delivery    = "3"
      Environment = var.environment
    }
  }
}
