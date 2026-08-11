import type { DragEvent } from "react"
import { useEffect, useRef } from "react"

export function useVariationDragPreview() {
  const previewRef = useRef<HTMLElement | null>(null)
  const previewOffsetRef = useRef({ x: 0, y: 0 })

  function removePreview() {
    previewRef.current?.remove()
    previewRef.current = null
  }

  function startPreview(event: DragEvent<HTMLButtonElement>) {
    removePreview()
    const row = event.currentTarget.closest("[data-variation-drag-row]")
    if (!row) return

    const bounds = row.getBoundingClientRect()
    const pointerX = Number.isFinite(event.clientX)
      ? event.clientX
      : bounds.left
    const pointerY = Number.isFinite(event.clientY) ? event.clientY : bounds.top
    const preview = row.cloneNode(true) as HTMLElement
    preview.setAttribute("aria-hidden", "true")
    preview.setAttribute("inert", "")
    preview.dataset.variationDragPreview = ""
    preview.style.position = "fixed"
    preview.style.inset = "0 auto auto 0"
    preview.style.width = `${bounds.width}px`
    preview.style.pointerEvents = "none"
    preview.style.zIndex = "50"
    preview.style.backgroundColor = "var(--background)"
    preview.style.border = "1px solid var(--border)"
    preview.style.borderRadius = "0.5rem"
    preview.style.opacity = "1"
    preview.style.transform = `translate3d(${bounds.left}px, ${bounds.top}px, 0)`
    preview.style.willChange = "transform"
    document.body.append(preview)
    previewRef.current = preview
    previewOffsetRef.current = {
      x: Math.max(0, pointerX - bounds.left),
      y: Math.max(0, pointerY - bounds.top),
    }

    const transparentDragImage = document.createElement("div")
    transparentDragImage.style.position = "fixed"
    transparentDragImage.style.width = "1px"
    transparentDragImage.style.height = "1px"
    transparentDragImage.style.opacity = "0"
    document.body.append(transparentDragImage)
    event.dataTransfer.setDragImage(transparentDragImage, 0, 0)
    window.setTimeout(() => transparentDragImage.remove(), 0)
  }

  function movePreview(clientX: number, clientY: number) {
    const preview = previewRef.current
    if (!preview || (clientX === 0 && clientY === 0)) return
    const { x, y } = previewOffsetRef.current
    preview.style.transform = `translate3d(${clientX - x}px, ${clientY - y}px, 0)`
  }

  useEffect(() => removePreview, [])

  return { startPreview, movePreview, removePreview }
}
