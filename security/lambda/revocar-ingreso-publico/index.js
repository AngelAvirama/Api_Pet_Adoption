// Autonomous remediation of an exposure (experiment 2, round 1). EventBridge
// sends every security group ingress change recorded by CloudTrail; the
// decision (decidir.js, the versioned detection) says whether a private group
// (ECS or RDS) was opened to the Internet. If so the Lambda:
//   1. logs "exposicion_detectada" (detection, used to measure MTTD),
//   2. revokes the rule when REMEDIATION_MODE=contener (containment, MTTC),
//   3. publishes the alert to SNS (e-mail to the owner of the layer).
// The Lambda only holds ec2:RevokeSecurityGroupIngress on the two protected
// groups and sns:Publish on its topic.
const { decidir } = require('./decidir');

const registrar = (evento, datos) => {
  console.log(JSON.stringify({ t: new Date().toISOString(), evento, ...datos }));
};

const crearHandler = ({ ec2, sns, comandos, env }) => async (evento) => {
  const protegidos = (env.PROTECTED_GROUPS || '').split(',').map((g) => g.trim()).filter(Boolean);
  const decision = decidir(evento, protegidos);

  if (!decision.exposicion) {
    registrar('cambio_sin_exposicion', decision);
    return decision;
  }

  registrar('exposicion_detectada', decision);
  const resultado = { ...decision, revocadas: [], alerta_enviada: false };

  if (env.REMEDIATION_MODE === 'contener' && decision.reglas.length) {
    try {
      await ec2.send(new comandos.RevokeSecurityGroupIngressCommand({
        GroupId: decision.grupo,
        SecurityGroupRuleIds: decision.reglas
      }));
      resultado.revocadas = decision.reglas;
      registrar('exposicion_contenida', { grupo: decision.grupo, reglas: decision.reglas });
    } catch (error) {
      registrar('contencion_fallida', { grupo: decision.grupo, error: error.message });
    }
  }

  if (env.ALERT_TOPIC_ARN) {
    try {
      await sns.send(new comandos.PublishCommand({
        TopicArn: env.ALERT_TOPIC_ARN,
        Subject: `[seguridad] Grupo ${decision.grupo} abierto a Internet`,
        Message: JSON.stringify(resultado, null, 2)
      }));
      resultado.alerta_enviada = true;
    } catch (error) {
      registrar('alerta_fallida', { error: error.message });
    }
  }

  return resultado;
};

let handlerReal = null;

// The AWS SDK v3 is part of the Lambda Node.js runtime, so it is only loaded
// there and never by the tests
exports.handler = async (evento) => {
  if (!handlerReal) {
    const { EC2Client, RevokeSecurityGroupIngressCommand } = require('@aws-sdk/client-ec2');
    const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
    handlerReal = crearHandler({
      ec2: new EC2Client({}),
      sns: new SNSClient({}),
      comandos: { RevokeSecurityGroupIngressCommand, PublishCommand },
      env: process.env
    });
  }
  return handlerReal(evento);
};

exports.crearHandler = crearHandler;
