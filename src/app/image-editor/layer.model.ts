// layer.model.ts
export class Layer {
    type: 'image' | 'text';
    content: HTMLImageElement | string;
    x: number = 0;
    y: number = 0;
    width: number = 100;
    height: number = 100;
    rotation: number = 0;
    fontSize: number = 20;
    fontFamily: string = 'Arial';
    color: string = 'black';
  
    constructor(type: 'image' | 'text', content: HTMLImageElement | string) {
      this.type = type;
      this.content = content;
      if (type === 'image') {
        const img = content as HTMLImageElement;
        this.width = img.width;
        this.height = img.height;
      }
    }
  
    draw(ctx: CanvasRenderingContext2D): void {
      ctx.save();
      ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
      ctx.rotate(this.rotation);
      if (this.type === 'image') {
        ctx.drawImage(this.content as HTMLImageElement, -this.width / 2, -this.height / 2, this.width, this.height);
      } else {
        ctx.font = `${this.fontSize}px ${this.fontFamily}`;
        ctx.fillStyle = this.color;
        ctx.fillText(this.content as string, -this.width / 2, -this.height / 2);
      }
      ctx.restore();
    }
  
    clone(): Layer {
      const clone = new Layer(this.type, this.content);
      Object.assign(clone, this);
      return clone;
    }
  }