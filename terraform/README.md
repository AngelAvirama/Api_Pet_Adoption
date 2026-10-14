# Infraestructura como código — API Pet Adoption

## 1. Descripción

Este directorio contiene la infraestructura de AWS definida mediante Terraform para desplegar la API de adopción de mascotas.

La configuración está dividida en archivos `.tf` para facilitar su mantenimiento y separar las responsabilidades de cada componente.

## 2. Arquitectura

La infraestructura contempla los siguientes servicios:

- **Amazon VPC:** red virtual donde se alojan los componentes.
- **Subredes públicas y privadas:** separan el acceso a la API del acceso a la base de datos.
- **Security Groups:** controlan el tráfico permitido entre los componentes.
- **Amazon ECR:** almacena la imagen de contenedor de la API.
- **Amazon ECS con Fargate:** ejecuta la API sin administrar servidores.
- **Application Load Balancer:** recibe las solicitudes HTTP y las distribuye a la API.
- **Amazon RDS for PostgreSQL:** almacena la información de la aplicación.
- **AWS Secrets Manager:** almacena la cadena de conexión de la base de datos.
- **Amazon CloudWatch:** conserva los registros y monitorea el uso de CPU y memoria del servicio ECS.

## 3. Organización de archivos

| Archivo | Responsabilidad |
|---|---|
| `versions.tf` | Versión mínima de Terraform y proveedores requeridos. |
| `providers.tf` | Configuración del proveedor AWS y etiquetas comunes. |
| `variables.tf` | Variables configurables de la infraestructura. |
| `outputs.tf` | Valores de salida de Terraform. |
| `network.tf` | VPC, subredes, gateway y tablas de rutas. |
| `security_groups.tf` | Reglas de acceso de red. |
| `ecr.tf` | Repositorio de imágenes de la API. |
| `rds.tf` | Base de datos PostgreSQL. |
| `secrets.tf` | Secreto con la conexión a la base de datos y permisos de lectura. |
| `ecs.tf` | Clúster, roles, definición de tarea y servicio ECS. |
| `alb.tf` | Balanceador, grupo de destino y listener HTTP. |
| `cloudwatch.tf` | Alarmas de CPU y memoria de ECS. |

## 4. Requisitos previos

- Terraform instalado.
- AWS CLI instalado y configurado con credenciales autorizadas.
- Permisos suficientes para crear y administrar los recursos declarados.
- Una imagen de la API publicada en Amazon ECR antes de iniciar el servicio ECS.
- Una contraseña para la base de datos, suministrada mediante una variable sensible y no almacenada en Git.

## 5. Preparación y validación

Desde la raíz del repositorio, inicializar Terraform:

```powershell
terraform -chdir=terraform init
```

Formatear los archivos:

```powershell
terraform -chdir=terraform fmt
```

Validar la configuración:

```powershell
terraform -chdir=terraform validate
```

Revisar los cambios que se crearían:

```powershell
terraform -chdir=terraform plan
```

Para ejecutar el plan se debe proporcionar la contraseña mediante un mecanismo seguro de variables de Terraform. No se debe publicar la contraseña ni los archivos de variables en GitHub.

## 6. Despliegue

Antes de desplegar, verificar que la imagen indicada por `image_tag` exista en ECR y que la configuración de la aplicación sea compatible con las variables de entorno definidas en `ecs.tf`.

Después de revisar el plan, la infraestructura puede crearse mediante:

```powershell
terraform -chdir=terraform apply
```

El despliegue requiere credenciales AWS válidas y puede generar costos por los recursos aprovisionados.

## 7. Eliminación de recursos

Después de la demostración, revisar el plan de destrucción:

```powershell
terraform -chdir=terraform plan -destroy
```

Si se confirma que los recursos pueden eliminarse, ejecutar:

```powershell
terraform -chdir=terraform destroy
```

La destrucción elimina los recursos administrados por esa configuración de Terraform. Debe verificarse previamente si existe información que deba conservarse.

## 8. Seguridad y costos

- La base de datos no debe ser accesible públicamente.
- El acceso a PostgreSQL se limita mediante Security Groups.
- Las credenciales no deben guardarse en el repositorio.
- El estado de Terraform puede contener información sensible y debe protegerse.
- Los recursos desplegados pueden generar costos. Deben eliminarse al terminar las pruebas y la presentación, verificando que no queden recursos facturables.