/** Converte erros do Supabase/PostgREST/Postgres em mensagens claras para o usuário. */
export interface AppErrorLike {
  message?: string
  code?: string
  details?: string | null
  hint?: string | null
  status?: number
}

const CODE_MESSAGES: Record<string, string> = {
  '42501': 'Você não tem permissão para realizar esta ação.',
  '23505': 'Já existe um registro com estes dados.',
  '23503': 'Este registro está vinculado a outros dados e não pode ser alterado/excluído assim.',
  '23502': 'Preencha todos os campos obrigatórios.',
  '22P02': 'Algum valor informado está em formato inválido.',
  '54000': 'Limite atingido. Tente novamente mais tarde.',
  PGRST116: 'Registro não encontrado ou sem acesso.',
  PGRST301: 'Sua sessão expirou. Entre novamente.',
}

export function toUserMessage(err: unknown): string {
  if (!err) return 'Erro desconhecido.'
  if (typeof err === 'string') return err
  const e = err as AppErrorLike
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'Sem conexão com a internet. Verifique sua rede e tente novamente.'
  const msg = e.message ?? ''
  // Mensagens de regra de negócio lançadas pelo banco (raise exception) já estão em português
  if (e.code && ['23514', 'P0001', 'P0002', '22023'].includes(e.code) && msg) return msg
  if (e.code === '42501' && /row-level security/i.test(msg)) return CODE_MESSAGES['42501']
  if (e.code === '42501' && msg && !/permission denied/i.test(msg)) return msg
  if (e.code === '23505' && msg && !/duplicate key/i.test(msg)) return msg
  if (e.code === '54000' && msg) return msg
  if (e.code && CODE_MESSAGES[e.code]) return CODE_MESSAGES[e.code]
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'Falha de conexão com o servidor. Tente novamente.'
  if (/Invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.'
  if (/Email not confirmed/i.test(msg)) return 'Confirme seu e-mail antes de entrar (verifique sua caixa de entrada).'
  if (/User already registered/i.test(msg)) return 'Já existe uma conta com este e-mail.'
  if (/Password should be/i.test(msg)) return 'A senha não atende aos requisitos mínimos.'
  if (/rate limit/i.test(msg)) return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
  if (/check constraint/i.test(msg)) return 'Algum valor está fora do permitido. Revise os campos.'
  return msg || 'Não foi possível concluir a operação.'
}
