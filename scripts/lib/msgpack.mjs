const utf8 = new TextDecoder('utf-8')

export function decodeMessagePack(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 0

  function take(length) {
    const start = offset
    offset += length
    if (offset > bytes.length) throw new Error('Unexpected end of MessagePack data')
    return bytes.subarray(start, offset)
  }

  function length16() {
    const value = view.getUint16(offset)
    offset += 2
    return value
  }

  function length32() {
    const value = view.getUint32(offset)
    offset += 4
    return value
  }

  function readString(length) {
    return utf8.decode(take(length))
  }

  function readArray(length) {
    const value = new Array(length)
    for (let i = 0; i < length; i++) value[i] = read()
    return value
  }

  function readMap(length) {
    const value = {}
    for (let i = 0; i < length; i++) value[String(read())] = read()
    return value
  }

  function readInteger64(signed) {
    const value = signed ? view.getBigInt64(offset) : view.getBigUint64(offset)
    offset += 8
    return value >= Number.MIN_SAFE_INTEGER && value <= Number.MAX_SAFE_INTEGER
      ? Number(value)
      : value.toString()
  }

  function readExtension(length) {
    const type = view.getInt8(offset)
    offset += 1
    return { type, data: take(length) }
  }

  function read() {
    const marker = view.getUint8(offset++)
    if (marker <= 0x7f) return marker
    if (marker >= 0xe0) return marker - 0x100
    if ((marker & 0xe0) === 0xa0) return readString(marker & 0x1f)
    if ((marker & 0xf0) === 0x90) return readArray(marker & 0x0f)
    if ((marker & 0xf0) === 0x80) return readMap(marker & 0x0f)

    switch (marker) {
      case 0xc0: return null
      case 0xc2: return false
      case 0xc3: return true
      case 0xc4: return take(view.getUint8(offset++))
      case 0xc5: return take(length16())
      case 0xc6: return take(length32())
      case 0xc7: return readExtension(view.getUint8(offset++))
      case 0xc8: return readExtension(length16())
      case 0xc9: return readExtension(length32())
      case 0xca: { const value = view.getFloat32(offset); offset += 4; return value }
      case 0xcb: { const value = view.getFloat64(offset); offset += 8; return value }
      case 0xcc: return view.getUint8(offset++)
      case 0xcd: { const value = view.getUint16(offset); offset += 2; return value }
      case 0xce: { const value = view.getUint32(offset); offset += 4; return value }
      case 0xcf: return readInteger64(false)
      case 0xd0: return view.getInt8(offset++)
      case 0xd1: { const value = view.getInt16(offset); offset += 2; return value }
      case 0xd2: { const value = view.getInt32(offset); offset += 4; return value }
      case 0xd3: return readInteger64(true)
      case 0xd4: return readExtension(1)
      case 0xd5: return readExtension(2)
      case 0xd6: return readExtension(4)
      case 0xd7: return readExtension(8)
      case 0xd8: return readExtension(16)
      case 0xd9: return readString(view.getUint8(offset++))
      case 0xda: return readString(length16())
      case 0xdb: return readString(length32())
      case 0xdc: return readArray(length16())
      case 0xdd: return readArray(length32())
      case 0xde: return readMap(length16())
      case 0xdf: return readMap(length32())
      default: throw new Error(`Unsupported MessagePack marker 0x${marker.toString(16)}`)
    }
  }

  const value = read()
  if (offset !== bytes.length) throw new Error(`Trailing MessagePack data: ${bytes.length - offset} bytes`)
  return value
}
