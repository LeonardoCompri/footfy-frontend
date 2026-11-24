import type { AxiosError } from 'axios'

export interface FileDownload {
  blob: Blob
  filename: string
}

function decodeFilename(value: string): string | null {
  try {
    return decodeURIComponent(value.trim().replace(/^"|"$/g, '')) || null
  } catch {
    return null
  }
}

export function filenameFromContentDisposition(header: unknown): string | null {
  if (typeof header !== 'string') return null
  const encoded = /filename\*\s*=\s*[^']*'[^']*'([^;]+)/i.exec(header)
  const decoded = encoded && decodeFilename(encoded[1])
  if (decoded) return decoded
  const plain = /filename\s*=\s*(?:"([^"]+)"|([^;]+))/i.exec(header)
  return (plain?.[1] ?? plain?.[2])?.trim() || null
}

export async function parseBlobError(err: unknown): Promise<unknown> {
  const response = (err as AxiosError).response
  if (!(response?.data instanceof Blob)) return err
  try {
    response.data = JSON.parse(await response.data.text())
  } catch {
    response.data = undefined
  }
  return err
}
