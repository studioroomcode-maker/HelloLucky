/**
 * Web stand-in for react-native-nitro-image (metro.config.js aliases it on web only): the Image calls
 * wideScan.ts and cloverCrop.ts make, on a canvas. Photos reach here without EXIF (src/web/photo.ts re-encodes them),
 * so the browser's decode and wideScan's EXIF turn never both rotate one picture.
 */
class WebImage {
  constructor(private readonly canvas: HTMLCanvasElement) {}

  get width() {
    return this.canvas.width;
  }

  get height() {
    return this.canvas.height;
  }

  private draw(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    paint(ctx);
    return new WebImage(canvas);
  }

  async cropAsync(left: number, top: number, right: number, bottom: number) {
    return this.draw(right - left, bottom - top, (ctx) => ctx.drawImage(this.canvas, -left, -top));
  }

  async resizeAsync(width: number, height: number) {
    return this.draw(width, height, (ctx) => ctx.drawImage(this.canvas, 0, 0, width, height));
  }

  async rotateAsync(degrees: number) {
    const turn = ((degrees % 360) + 360) % 360;
    const side = turn === 90 || turn === 270;
    const [w, h] = side ? [this.height, this.width] : [this.width, this.height];
    return this.draw(w, h, (ctx) => {
      ctx.translate(w / 2, h / 2);
      ctx.rotate((turn * Math.PI) / 180);
      ctx.drawImage(this.canvas, -this.width / 2, -this.height / 2);
    });
  }

  async toRawPixelDataAsync() {
    const { data } = this.canvas.getContext('2d')!.getImageData(0, 0, this.width, this.height);
    return { buffer: data.buffer as ArrayBuffer, width: this.width, height: this.height, pixelFormat: 'RGBA' };
  }

  /** A blob: URI, displayable and readable for the rest of the session (findsStore keeps it as a data: URI). */
  async saveToTemporaryFileAsync(_format: 'jpg' | 'png', quality = 90) {
    const blob = await new Promise<Blob | null>((resolve) => this.canvas.toBlob(resolve, 'image/jpeg', quality / 100));
    if (!blob) throw new Error('image: could not encode');
    return URL.createObjectURL(blob);
  }
}

export async function imageFromBlob(blob: Blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
  bitmap.close();
  return new WebImage(canvas);
}

export const Images = {
  async loadFromFileAsync(path: string) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`image: could not read ${path}`);
    return imageFromBlob(await response.blob());
  },
};
