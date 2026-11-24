/** Redimensiona e comprime imagens no navegador antes do upload (economiza banda e armazenamento). */
export async function compressImage(file: File, maxSide = 1600, quality = 0.82): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Use imagens JPG, PNG ou WEBP')
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível processar a imagem')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', quality))
  if (!blob) throw new Error('Falha ao comprimir a imagem')
  if (blob.size > 5 * 1024 * 1024) throw new Error('Imagem muito grande mesmo após compressão (máx. 5 MB)')
  return blob
}
