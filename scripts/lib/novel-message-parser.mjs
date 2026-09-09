export const MESSAGE_COMMANDS = ['message', 'dotmessage', 'messageTextCenter', 'messageTextUnder', 'l2dmessage']

function stripMessageMeta(text) {
  let message = text
  for (;;) {
    const before = message
    message = message
      .replace(/,{2,}$/, '')
      .replace(/,{2,3}(?:on|off|ALLON)$/, '')
      .replace(/,(?:\d{6,}[A-Z]?|[A-Z]?\d{6,}[A-Z]?),(?:vc|mcv)_[^,]*(?:,(?:\d+\/)?chara_\d+)?[,]?$/, '')
      .replace(/,(?:\d{6,}[A-Z]?|[A-Z]?\d{6,}[A-Z]?),(?:vc|mcv)_[^,]*(?:,(?:on|off|ALLON|(?:\d+\/)?chara_\d+(?:\/chara_\d+)*))?[,]?$/, '')
      .replace(/,(?:\d{6,}[A-Z]?|[A-Z]?\d{6,}[A-Z]?)(?:,,[^,]+)?$/, '')
      .replace(/,,(?:vc|mcv)_[^,]*(?:,(?:on|off|ALLON|(?:\d+\/)?chara_\d+(?:\/chara_\d+)*))?[,]?$/, '')
      .replace(/,(?:\d{6,}[A-Z]?|[A-Z]?\d{6,}[A-Z]?),(?:vc|mcv)_[^,\r\n]*(?:,[^\r\n]*)?$/, '')
      .replace(/,,(?:vc|mcv)_[^,\r\n]*(?:,[^\r\n]*)?$/, '')
      .replace(/,{2,3}(?:\d+\/)?chara_\d+(?:\/chara_\d+)*$/, '')
    if (message === before) return message
  }
}

export function parseMessageLine(line, lineNumber) {
  const command = MESSAGE_COMMANDS.find((name) => line.startsWith(`${name},`))
  if (!command) return null

  const rest = line.slice(`${command},`.length)
  const firstComma = rest.indexOf(',')
  if (firstComma < 0) return null
  const speaker = rest.slice(0, firstComma)
  const payload = rest.slice(firstComma + 1)
  const message = command === 'dotmessage'
    ? (() => {
        const metaSeparator = payload.indexOf(',,')
        return metaSeparator >= 0 ? payload.slice(0, metaSeparator) : payload.split(',')[0]
      })()
    : stripMessageMeta(payload)
  if (!message) return null

  const voice = payload.match(/(?:vc|mcv)_[^,]*/)?.[0] || null
  const chara = payload.match(/(?:\d+\/)?chara_\d+(?:\/chara_\d+)*/)?.[0] || null
  return { line: lineNumber, command, speaker, source: message, voice, chara }
}

export function extractMessageRecords(script, novelId, cacheFile) {
  const records = []
  const lines = String(script || '').split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const parsed = parseMessageLine(lines[i], i + 1)
    if (!parsed) continue
    records.push({ novelId, cacheFile, ...parsed })
  }
  return records
}
