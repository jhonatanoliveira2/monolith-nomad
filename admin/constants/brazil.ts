/**
 * Brazil as the default region: federative units (ISO 3166-2), IBGE macro-regions and the IANA time
 * zones in use. Shared by the server (map extracts, settings validation) and the setup wizard.
 *
 * Sources: IBGE regional division (5 macro-regions); IANA tz database zones for Brazil. The polygons
 * for map extracts come from Natural Earth admin-1 (public domain), see resources/geodata.
 */

export const BRAZIL_REGIONS = [
  { id: 'norte', name: 'Norte' },
  { id: 'nordeste', name: 'Nordeste' },
  { id: 'centro-oeste', name: 'Centro-Oeste' },
  { id: 'sudeste', name: 'Sudeste' },
  { id: 'sul', name: 'Sul' },
] as const

export type BrazilRegionId = (typeof BRAZIL_REGIONS)[number]['id']

export type BrazilState = {
  /** ISO 3166-2 code, e.g. BR-SP */
  code: string
  uf: string
  name: string
  region: BrazilRegionId
  /** Main IANA zone of the state (states with two zones list the capital's) */
  timezone: string
}

export const BRAZIL_STATES: BrazilState[] = [
  { code: 'BR-AC', uf: 'AC', name: 'Acre', region: 'norte', timezone: 'America/Rio_Branco' },
  { code: 'BR-AP', uf: 'AP', name: 'Amapá', region: 'norte', timezone: 'America/Belem' },
  { code: 'BR-AM', uf: 'AM', name: 'Amazonas', region: 'norte', timezone: 'America/Manaus' },
  { code: 'BR-PA', uf: 'PA', name: 'Pará', region: 'norte', timezone: 'America/Belem' },
  { code: 'BR-RO', uf: 'RO', name: 'Rondônia', region: 'norte', timezone: 'America/Porto_Velho' },
  { code: 'BR-RR', uf: 'RR', name: 'Roraima', region: 'norte', timezone: 'America/Boa_Vista' },
  { code: 'BR-TO', uf: 'TO', name: 'Tocantins', region: 'norte', timezone: 'America/Araguaina' },
  { code: 'BR-AL', uf: 'AL', name: 'Alagoas', region: 'nordeste', timezone: 'America/Maceio' },
  { code: 'BR-BA', uf: 'BA', name: 'Bahia', region: 'nordeste', timezone: 'America/Bahia' },
  { code: 'BR-CE', uf: 'CE', name: 'Ceará', region: 'nordeste', timezone: 'America/Fortaleza' },
  { code: 'BR-MA', uf: 'MA', name: 'Maranhão', region: 'nordeste', timezone: 'America/Fortaleza' },
  { code: 'BR-PB', uf: 'PB', name: 'Paraíba', region: 'nordeste', timezone: 'America/Fortaleza' },
  { code: 'BR-PE', uf: 'PE', name: 'Pernambuco', region: 'nordeste', timezone: 'America/Recife' },
  { code: 'BR-PI', uf: 'PI', name: 'Piauí', region: 'nordeste', timezone: 'America/Fortaleza' },
  {
    code: 'BR-RN',
    uf: 'RN',
    name: 'Rio Grande do Norte',
    region: 'nordeste',
    timezone: 'America/Fortaleza',
  },
  { code: 'BR-SE', uf: 'SE', name: 'Sergipe', region: 'nordeste', timezone: 'America/Maceio' },
  {
    code: 'BR-DF',
    uf: 'DF',
    name: 'Distrito Federal',
    region: 'centro-oeste',
    timezone: 'America/Sao_Paulo',
  },
  { code: 'BR-GO', uf: 'GO', name: 'Goiás', region: 'centro-oeste', timezone: 'America/Sao_Paulo' },
  {
    code: 'BR-MT',
    uf: 'MT',
    name: 'Mato Grosso',
    region: 'centro-oeste',
    timezone: 'America/Cuiaba',
  },
  {
    code: 'BR-MS',
    uf: 'MS',
    name: 'Mato Grosso do Sul',
    region: 'centro-oeste',
    timezone: 'America/Campo_Grande',
  },
  {
    code: 'BR-ES',
    uf: 'ES',
    name: 'Espírito Santo',
    region: 'sudeste',
    timezone: 'America/Sao_Paulo',
  },
  {
    code: 'BR-MG',
    uf: 'MG',
    name: 'Minas Gerais',
    region: 'sudeste',
    timezone: 'America/Sao_Paulo',
  },
  {
    code: 'BR-RJ',
    uf: 'RJ',
    name: 'Rio de Janeiro',
    region: 'sudeste',
    timezone: 'America/Sao_Paulo',
  },
  { code: 'BR-SP', uf: 'SP', name: 'São Paulo', region: 'sudeste', timezone: 'America/Sao_Paulo' },
  { code: 'BR-PR', uf: 'PR', name: 'Paraná', region: 'sul', timezone: 'America/Sao_Paulo' },
  {
    code: 'BR-RS',
    uf: 'RS',
    name: 'Rio Grande do Sul',
    region: 'sul',
    timezone: 'America/Sao_Paulo',
  },
  {
    code: 'BR-SC',
    uf: 'SC',
    name: 'Santa Catarina',
    region: 'sul',
    timezone: 'America/Sao_Paulo',
  },
]

/** Brazilian IANA zones, east to west, with the UTC offset Brazil uses (no daylight saving since 2019). */
export const BRAZIL_TIMEZONES: { id: string; offset: string; label: string }[] = [
  { id: 'America/Noronha', offset: 'UTC−2', label: 'Fernando de Noronha' },
  {
    id: 'America/Sao_Paulo',
    offset: 'UTC−3',
    label: 'Horário de Brasília (Sul, Sudeste, GO, DF)',
  },
  { id: 'America/Bahia', offset: 'UTC−3', label: 'Bahia' },
  { id: 'America/Fortaleza', offset: 'UTC−3', label: 'Ceará, Maranhão, Piauí, Paraíba, RN' },
  { id: 'America/Recife', offset: 'UTC−3', label: 'Pernambuco' },
  { id: 'America/Maceio', offset: 'UTC−3', label: 'Alagoas e Sergipe' },
  { id: 'America/Belem', offset: 'UTC−3', label: 'Pará (leste) e Amapá' },
  { id: 'America/Santarem', offset: 'UTC−3', label: 'Pará (oeste)' },
  { id: 'America/Araguaina', offset: 'UTC−3', label: 'Tocantins' },
  { id: 'America/Cuiaba', offset: 'UTC−4', label: 'Mato Grosso' },
  { id: 'America/Campo_Grande', offset: 'UTC−4', label: 'Mato Grosso do Sul' },
  { id: 'America/Manaus', offset: 'UTC−4', label: 'Amazonas (maior parte)' },
  { id: 'America/Porto_Velho', offset: 'UTC−4', label: 'Rondônia' },
  { id: 'America/Boa_Vista', offset: 'UTC−4', label: 'Roraima' },
  { id: 'America/Rio_Branco', offset: 'UTC−5', label: 'Acre' },
  { id: 'America/Eirunepe', offset: 'UTC−5', label: 'Amazonas (oeste)' },
]

export const DEFAULT_TIMEZONE = 'America/Sao_Paulo'

/** True when `tz` is a time zone the runtime knows (any IANA zone, not only Brazilian ones). */
export function isValidTimezone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)*$/.test(tz)) return false
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: tz })
    return true
  } catch {
    return false
  }
}
