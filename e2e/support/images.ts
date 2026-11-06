import type { Page } from '@playwright/test'

export function sampleImageUrl(label: string, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600">
    <rect width="1200" height="600" fill="${color}"/>
    <circle cx="600" cy="300" r="220" fill="#ffffff" fill-opacity="0.25"/>
    <text x="600" y="330" font-family="sans-serif" font-size="96" font-weight="bold"
      fill="#ffffff" text-anchor="middle">${label}</text>
  </svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export async function samplePng(page: Page, label: string, color: string): Promise<Buffer> {
  const dataUrl = await page.evaluate(
    async (src) => {
      const image = new Image()
      image.src = src
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      canvas.getContext('2d')!.drawImage(image, 0, 0)
      return canvas.toDataURL('image/png')
    },
    sampleImageUrl(label, color),
  )
  return Buffer.from(dataUrl.split(',')[1], 'base64')
}
