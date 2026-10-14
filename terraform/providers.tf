
provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = {
      Project   = "Api_Pet_Adoption"
      ManagedBy = "Terraform"
      Delivery  = "3"
    }
  }
}
