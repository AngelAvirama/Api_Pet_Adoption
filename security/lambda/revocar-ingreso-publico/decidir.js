// Detection as code (experiment 2): decides whether a CloudTrail event about
// a security group opened a private group to the Internet. Pure function:
// the Lambda uses it to contain, the tests and chaos/security/detecciones use
// it to prove that it fires on the adverse condition and stays silent on the
// normal changes of the platform.
const PUBLICOS = new Set(['0.0.0.0/0', '::/0']);

const EVENTOS = new Set(['AuthorizeSecurityGroupIngress', 'ModifySecurityGroupRules']);

// Walks the event and returns every object that carries a CIDR, wherever
// CloudTrail nested it (ipPermissions.items[].ipRanges.items[], the rule set
// of the response, or the ModifySecurityGroupRules request).
const conCidr = (nodo, encontrados = []) => {
  if (Array.isArray(nodo)) {
    nodo.forEach((n) => conCidr(n, encontrados));
  } else if (nodo && typeof nodo === 'object') {
    const cidr = nodo.cidrIp || nodo.cidrIpv6 || nodo.cidrIpv4 || nodo.CidrIpv4 || nodo.CidrIpv6;
    if (cidr) encontrados.push({ ...nodo, cidr });
    Object.values(nodo).forEach((v) => conCidr(v, encontrados));
  }
  return encontrados;
};

const grupoDe = (detalle) => detalle.requestParameters?.groupId
  || detalle.requestParameters?.ModifySecurityGroupRulesRequest?.GroupId
  || null;

const decidir = (evento, protegidos = []) => {
  const detalle = evento?.detail || {};
  const base = { exposicion: false, grupo: grupoDe(detalle), evento: detalle.eventName || null };

  if (detalle.eventSource !== 'ec2.amazonaws.com' || !EVENTOS.has(detalle.eventName)) {
    return { ...base, motivo: 'evento no relacionado' };
  }
  if (detalle.errorCode) {
    return { ...base, motivo: `la llamada fallo (${detalle.errorCode})` };
  }
  if (!protegidos.includes(base.grupo)) {
    return { ...base, motivo: 'grupo no protegido (por ejemplo el ALB, publico por diseño)' };
  }

  const publicos = conCidr([detalle.requestParameters, detalle.responseElements])
    .filter((n) => PUBLICOS.has(n.cidr) && n.isEgress !== true && n.IsEgress !== true);
  if (!publicos.length) {
    return { ...base, motivo: 'cambio sin origen publico' };
  }

  const reglas = [...new Set(publicos
    .map((n) => n.securityGroupRuleId || n.SecurityGroupRuleId)
    .concat(detalle.requestParameters?.ModifySecurityGroupRulesRequest?.SecurityGroupRule?.SecurityGroupRuleId)
    .filter(Boolean))];

  return {
    ...base,
    exposicion: true,
    motivo: 'regla de entrada abierta a Internet en un grupo privado',
    reglas,
    cidrs: [...new Set(publicos.map((n) => n.cidr))],
    actor: detalle.userIdentity?.arn || null,
    origen_ip: detalle.sourceIPAddress || null,
    t_evento: detalle.eventTime || evento.time || null
  };
};

module.exports = { decidir, conCidr, PUBLICOS, EVENTOS };
