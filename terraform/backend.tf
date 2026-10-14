
terraform {
  backend "s3" {
    bucket       = "pet-adoption-tfstate-296121913016-us-east-1"
    key          = "pet-adoption/demo/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}
