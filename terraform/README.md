# Infraestructura como código — API Pet Adoption

## 1. Descripción

Este directorio contiene la infraestructura de AWS definida mediante Terraform para desplegar la API de adopción de mascotas.

La configuración está dividida en archivos `.tf` para facilitar su mantenimiento y separar las responsabilidades de cada componente.

El proyecto utiliza GitHub Actions para automatizar la creación de la infraestructura, la publicación de la imagen de la API, las migraciones de la base de datos y la carga de datos iniciales.

## 2. Arquitectura

La infraestructura contempla los siguientes servicios:

- **Amazon VPC:** red virtual donde se alojan los componentes.
- **Subredes públicas y privadas:** organizan la conectividad de la aplicación y la base de datos.
- **Security Groups:** controlan el tráfico permitido entre los componentes.
- **Amazon ECR:** almacena las imágenes de contenedor de la API.
- **Amazon ECS con Fargate:** ejecuta la API sin necesidad de administrar servidores.
- **Application Load Balancer (ALB):** recibe las solicitudes HTTP y las distribuye a la API.
- **Amazon RDS for PostgreSQL:** almacena la información de la aplicación.
- **AWS Secrets Manager:** almacena la cadena de conexión de la base de datos.
- **Amazon CloudWatch:** conserva registros y monitorea el uso de CPU y memoria del servicio ECS.

La API se ejecuta en ECS Fargate y se conecta a PostgreSQL en RDS. Las solicitudes externas llegan a través del balanceador de carga.

## 3. Organización de archivos

| Archivo | Responsabilidad |
|---|---|
| `versions.tf` | Define la versión requerida de Terraform y los proveedores. |
| `providers.tf` | Configura el proveedor AWS y las etiquetas comunes. |
| `variables.tf` | Declara las variables configurables de la infraestructura. |
| `outputs.tf` | Expone valores de salida, como la URL de la API y los identificadores de recursos. |
| `network.tf` | Define la VPC, las subredes, el gateway y las tablas de rutas. |
| `security_groups.tf` | Define las reglas de acceso de red. |
| `ecr.tf` | Configura el repositorio de imágenes de la API y su política de ciclo de vida. |
| `rds.tf` | Define la base de datos PostgreSQL y sus recursos asociados. |
| `secrets.tf` | Configura el secreto con la conexión a la base de datos y los permisos de lectura. |
| `ecs.tf` | Define el clúster, los roles, la definición de tarea y el servicio ECS. |
| `alb.tf` | Configura el balanceador, el grupo de destino y el listener HTTP. |
| `cloudwatch.tf` | Configura las alarmas de CPU y memoria de ECS. |

## 4. Requisitos previos

Para desplegar la infraestructura se requiere:

- Terraform instalado.
- AWS CLI instalado y configurado con credenciales autorizadas.
- Permisos suficientes para crear y administrar los recursos declarados.
- Acceso al repositorio de GitHub.
- El secreto `DB_PASSWORD` configurado en GitHub Actions.
- El rol IAM `github-actions-pet-adoption` configurado para permitir la autenticación mediante OIDC.
- Un bucket S3 existente para almacenar el estado remoto de Terraform.

Las credenciales y contraseñas deben gestionarse mediante mecanismos seguros. No deben guardarse en el repositorio ni publicarse en archivos de configuración.

## 5. Preparación y validación de Terraform

Los siguientes comandos se ejecutan desde la raíz del repositorio.

### Inicializar Terraform

```powershell
terraform -chdir=terraform init
```

### Formatear los archivos

```powershell
terraform -chdir=terraform fmt
```

### Validar la configuración

```powershell
terraform -chdir=terraform validate
```

### Revisar el plan de infraestructura

```powershell
terraform -chdir=terraform plan
```

El comando `plan` permite revisar los cambios previstos antes de aplicarlos. Para ejecutarlo localmente, se deben proporcionar las variables requeridas mediante un mecanismo seguro.

## 6. Despliegue mediante GitHub Actions

El proyecto dispone del workflow:

`.github/workflows/deploy-terraform.yml`

El despliegue se ejecuta manualmente desde GitHub Actions.

### Procedimiento

1. Ingresar al repositorio en GitHub.
2. Abrir la pestaña **Actions**.
3. Seleccionar el workflow **Deploy Terraform and ECS**.
4. Seleccionar **Run workflow**.
5. Confirmar la creación de recursos que pueden generar costos.
6. Esperar a que finalicen todos los pasos y verificar que el workflow termine correctamente.

### Etapas del pipeline

El workflow automatiza las siguientes tareas:

1. Descarga el código del repositorio.
2. Configura Terraform y las credenciales de AWS mediante OIDC.
3. Inicializa y valida la configuración de Terraform.
4. Crea el repositorio de imágenes en Amazon ECR.
5. Construye y publica la imagen de la API.
6. Genera y aplica el plan de infraestructura con el servicio API inicialmente detenido.
7. Ejecuta las migraciones de Prisma mediante una tarea temporal de ECS.
8. Ejecuta la semilla de datos mediante una tarea temporal de ECS.
9. Inicia el servicio de la API.
10. Verifica la disponibilidad del endpoint de salud.

La semilla crea los datos iniciales de animales y adoptantes, además de una adopción de ejemplo. Su implementación comprueba la existencia de registros para evitar duplicados cuando se vuelve a ejecutar.

Si las migraciones o la semilla fallan, el pipeline debe detenerse y reportar el error.

### Verificación del despliegue

Cuando el workflow termine correctamente, obtener la URL pública de la API con:

```powershell
terraform -chdir=terraform output -raw api_url
```

Comprobar el endpoint de salud:

```powershell
Invoke-RestMethod -Uri "URL_DE_LA_API/api/health" -Method Get
```

Reemplazar `URL_DE_LA_API` por la URL obtenida. La respuesta esperada es un estado satisfactorio de la API.

También se pueden probar los endpoints de animales, adoptantes y adopciones desde Postman.

## 7. Eliminación de recursos

Después de las pruebas o de la sustentación, se puede destruir la infraestructura para evitar costos innecesarios.

Desde la raíz del repositorio, ejecutar en PowerShell:

```powershell
.\scripts\destroy-infra.ps1
```

Este script automatiza el proceso de limpieza:

1. Verifica la existencia del repositorio de imágenes en Amazon ECR.
2. Elimina las imágenes almacenadas en el repositorio.
3. Comprueba que el repositorio esté vacío.
4. Solicita confirmación explícita antes de iniciar la destrucción.
5. Ejecuta `terraform destroy` para eliminar los recursos administrados por Terraform.

La destrucción elimina los recursos de la aplicación, incluida la base de datos. Los datos almacenados pueden perderse permanentemente.

**Importante:** el bucket S3 utilizado para el estado remoto de Terraform debe conservarse. El script no está diseñado para eliminarlo.

### Verificar la destrucción

Después de finalizar el script, comprobar el estado principal:

```powershell
terraform -chdir=terraform state list
```

Si no se muestran recursos, el estado principal no registra recursos administrados.

También se debe verificar que el bucket S3 del estado remoto siga existiendo y comprobar que no queden recursos facturables en AWS.

## 8. Seguridad y costos

- La base de datos debe permanecer protegida y no ser accesible públicamente.
- El acceso a PostgreSQL se controla mediante Security Groups.
- Las credenciales deben gestionarse mediante secretos y variables sensibles.
- El estado de Terraform puede contener información sensible y debe protegerse.
- La autenticación del pipeline utiliza OIDC para asumir un rol IAM de AWS.
- Los recursos desplegados pueden generar costos. Deben eliminarse al terminar las pruebas y la presentación, verificando que no queden recursos facturables.
- Antes de destruir la infraestructura, se debe respaldar cualquier información que sea necesario conservar.

## 9. Pruebas realizadas

Las pruebas de funcionamiento incluyen:

- Ejecución exitosa del pipeline de despliegue.
- Aplicación de migraciones de Prisma.
- Ejecución automática de la semilla de datos.
- Verificación del endpoint de salud de la API.
- Pruebas de consulta, creación, actualización y eliminación de registros mediante Postman.
- Ejecución del script de destrucción de infraestructura.
- Verificación de que el estado principal de Terraform queda sin recursos registrados.
- Verificación de que el bucket S3 del estado remoto se conserva.

Estas pruebas permiten demostrar tanto el despliegue automatizado como el procedimiento de limpieza de la infraestructura.