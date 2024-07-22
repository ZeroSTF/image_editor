import { Component, OnInit, ViewChild, ElementRef, HostListener  } from '@angular/core';
import { Layer } from './layer.model';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { RemoveBgService } from './remove-bg.service';
import { HttpClientModule } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSliderModule } from '@angular/material/slider';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatAccordion, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle } from '@angular/material/expansion';
import { MatTab, MatTabGroup } from '@angular/material/tabs';

interface CanvasPreset {
  name: string;
  width: number;
  height: number;
}

@Component({
  selector: 'app-image-editor',
  templateUrl: './image-editor.component.html',
  styleUrls: ['./image-editor.component.css'],
  standalone: true,
  imports: [
    FormsModule, 
    CommonModule, 
    HttpClientModule, 
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatSliderModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatAccordion,
    MatExpansionPanel,
    MatExpansionPanelHeader,
    MatExpansionPanelTitle,
    MatTabGroup,
    MatTab
  ]
})
export class ImageEditorComponent implements OnInit {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;
  
  layers: Layer[] = [];
  selectedLayer: Layer | null = null;
  canvasWidth = 800;
  canvasHeight = 600;

  undoStack: Layer[][] = [];
  redoStack: Layer[][] = [];

  isDragging = false;
  isRotating = false;
  dragStartX = 0;
  dragStartY = 0;
  rotationStartAngle = 0;

  isLoading = false;

  canvasPresets: { [key: string]: CanvasPreset[] } = {
    facebook: [
      { name: 'Profile Picture', width: 400, height: 400 },
      { name: 'AD', width: 1200, height: 630 },
      { name: 'Story', width: 1080, height: 1920 },
      { name: 'Post', width: 1200, height: 630 },
      { name: 'Cover', width: 1125, height: 633 }
    ],
    instagram: [
      { name: 'Story', width: 1080, height: 1920 },
      { name: 'Profile Picture', width: 320, height: 320 }
    ]
  };

  constructor(private backgroundRemovalService: RemoveBgService) { }

  ngOnInit(): void {
    this.ctx = this.canvasRef.nativeElement.getContext('2d')!;
    this.redraw();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      for (let i = 0; i < input.files.length; i++) {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          const img = new Image();
          img.onload = () => {
            const layer = new Layer('image', img);
            this.addLayer(layer);
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(input.files[i]);
      }
    }
  }

  addTextLayer(): void {
    const layer = new Layer('text', 'New Text');
    this.addLayer(layer);
  }

  addLayer(layer: Layer): void {
    this.saveState();
    this.layers.push(layer);
    this.selectedLayer = layer;
    this.redraw();
  }

  selectLayer(layer: Layer): void {
    this.selectedLayer = layer;
  }

  updateLayerProperty(property: string, value: any): void {
    if (this.selectedLayer) {
      this.saveState();
      (this.selectedLayer as any)[property] = value;
      this.redraw();
    }
  }

  moveLayer(direction: 'up' | 'down'): void {
    if (!this.selectedLayer) return;
    const index = this.layers.indexOf(this.selectedLayer);
    if (direction === 'up' && index < this.layers.length - 1) {
      this.saveState();
      [this.layers[index], this.layers[index + 1]] = [this.layers[index + 1], this.layers[index]];
    } else if (direction === 'down' && index > 0) {
      this.saveState();
      [this.layers[index], this.layers[index - 1]] = [this.layers[index - 1], this.layers[index]];
    }
    this.redraw();
  }

  deleteLayer(): void {
    if (this.selectedLayer) {
      this.saveState();
      this.layers = this.layers.filter(layer => layer !== this.selectedLayer);
      this.selectedLayer = this.layers[this.layers.length - 1] || null;
      this.redraw();
    }
  }

  redraw(): void {
    this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
    this.layers.forEach(layer => {
      this.ctx.save();
      this.ctx.translate(layer.x + layer.width / 2, layer.y + layer.height / 2);
      this.ctx.rotate(layer.rotation);
      if (layer.type === 'image') {
        this.ctx.drawImage(layer.content as HTMLImageElement, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
      } else {
        this.ctx.font = `${layer.fontSize}px ${layer.fontFamily}`;
        this.ctx.fillStyle = layer.color;
        this.ctx.fillText(layer.content as string, -layer.width / 2, -layer.height / 2);
      }
      this.ctx.restore();
    });
    
    if (this.selectedLayer) {
      this.drawSelectionBorder(this.selectedLayer);
      this.drawRotateHandle(this.selectedLayer);
    }
  }

  drawSelectionBorder(layer: Layer): void {
    this.ctx.strokeStyle = '#00f';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(layer.x, layer.y, layer.width, layer.height);
  }

  drawResizeHandle(layer: Layer): void {
    const handleSize = 10;
    this.ctx.fillStyle = '#00f';
    this.ctx.fillRect(
      layer.x + layer.width - handleSize,
      layer.y + layer.height - handleSize,
      handleSize,
      handleSize
    );
  }

  saveState(): void {
    this.undoStack.push(this.layers.map(layer => layer.clone()));
    this.redoStack = [];
  }

  undo(): void {
    if (this.undoStack.length > 0) {
      this.redoStack.push(this.layers.map(layer => layer.clone()));
      this.layers = this.undoStack.pop()!;
      this.selectedLayer = this.layers[this.layers.length - 1] || null;
      this.redraw();
    }
  }

  redo(): void {
    if (this.redoStack.length > 0) {
      this.undoStack.push(this.layers.map(layer => layer.clone()));
      this.layers = this.redoStack.pop()!;
      this.selectedLayer = this.layers[this.layers.length - 1] || null;
      this.redraw();
    }
  }

  export(format: 'png' | 'jpeg' = 'png'): void {
    const dataUrl = this.canvasRef.nativeElement.toDataURL(`image/${format}`);
    const link = document.createElement('a');
    link.download = `edited-image.${format}`;
    link.href = dataUrl;
    link.click();
  }

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent): void {
    if (this.selectedLayer) {
      const rect = this.canvasRef.nativeElement.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      if (this.isPointInRotateHandle(x, y, this.selectedLayer)) {
        this.isRotating = true;
        this.rotationStartAngle = Math.atan2(y - (this.selectedLayer.y + this.selectedLayer.height / 2),
                                             x - (this.selectedLayer.x + this.selectedLayer.width / 2));
      } else if (this.isPointInLayer(x, y, this.selectedLayer)) {
        this.isDragging = true;
        this.dragStartX = x - this.selectedLayer.x;
        this.dragStartY = y - this.selectedLayer.y;
      }
    }
  }

  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (this.isDragging && this.selectedLayer) {
      this.selectedLayer.x = x - this.dragStartX;
      this.selectedLayer.y = y - this.dragStartY;
      this.redraw();
    } else if (this.isRotating && this.selectedLayer) {
      const centerX = this.selectedLayer.x + this.selectedLayer.width / 2;
      const centerY = this.selectedLayer.y + this.selectedLayer.height / 2;
      const angle = Math.atan2(y - centerY, x - centerX);
      this.selectedLayer.rotation += angle - this.rotationStartAngle;
      this.rotationStartAngle = angle;
      this.redraw();
    } else {
      this.updateCursor(x, y);
    }
  }

  @HostListener('mouseup')
  onMouseUp(): void {
    if (this.isDragging || this.isRotating) {
      this.isDragging = false;
      this.isRotating = false;
      this.saveState();
    }
  }

  @HostListener('wheel', ['$event'])
  onWheel(event: WheelEvent): void {
    if (this.selectedLayer && event.ctrlKey) {
      event.preventDefault();
      const scaleFactor = event.deltaY > 0 ? 0.95 : 1.05;
      this.resizeSelectedLayer(scaleFactor, true);
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (this.selectedLayer && event.ctrlKey) {
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        this.resizeSelectedLayer(1.1, true);
      } else if (event.key === '-') {
        event.preventDefault();
        this.resizeSelectedLayer(0.9, true);
      }
    }
  }

  resizeSelectedLayer(scaleFactor: number, preserveAspectRatio: boolean): void {
    if (this.selectedLayer) {
      const oldWidth = this.selectedLayer.width;
      const oldHeight = this.selectedLayer.height;
      this.selectedLayer.width *= scaleFactor;
      if (preserveAspectRatio) {
        this.selectedLayer.height *= scaleFactor;
      }
      this.selectedLayer.x -= (this.selectedLayer.width - oldWidth) / 2;
      this.selectedLayer.y -= (this.selectedLayer.height - oldHeight) / 2;
      this.redraw();
      this.saveState();
    }
  }

  isPointInRotateHandle(x: number, y: number, layer: Layer): boolean {
    const handleSize = 10;
    return x >= layer.x + layer.width - handleSize &&
           x <= layer.x + layer.width &&
           y >= layer.y + layer.height - handleSize &&
           y <= layer.y + layer.height;
  }

  isPointInLayer(x: number, y: number, layer: Layer): boolean {
    return x >= layer.x && x <= layer.x + layer.width &&
           y >= layer.y && y <= layer.y + layer.height;
  }

  selectLayerAtPoint(x: number, y: number): void {
    for (let i = this.layers.length - 1; i >= 0; i--) {
      if (this.isPointInLayer(x, y, this.layers[i])) {
        this.selectedLayer = this.layers[i];
        this.redraw();
        return;
      }
    }
    // If no layer was clicked, we don't change the selection
    // this.selectedLayer = null;  // Remove or comment out this line
  }

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent): void {
  const rect = this.canvasRef.nativeElement.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  
  // Check if the click is inside the canvas
  if (x >= 0 && x <= this.canvasWidth && y >= 0 && y <= this.canvasHeight) {
    this.selectLayerAtPoint(x, y);
  }
  // If the click is outside the canvas, we don't change the selection
}

  updateCursor(x: number, y: number): void {
    if (this.selectedLayer && this.isPointInRotateHandle(x, y, this.selectedLayer)) {
      this.canvasRef.nativeElement.style.cursor = 'grab';
    } else {
      for (let i = this.layers.length - 1; i >= 0; i--) {
        if (this.isPointInLayer(x, y, this.layers[i])) {
          this.canvasRef.nativeElement.style.cursor = 'move';
          return;
        }
      }
      this.canvasRef.nativeElement.style.cursor = 'default';
    }
  }

  removeBackground(): void {
    if (!this.selectedLayer || this.selectedLayer.type !== 'image') return;

    this.isLoading = true;
    const layer = this.selectedLayer;
    const canvas = document.createElement('canvas');
    canvas.width = layer.width;
    canvas.height = layer.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(layer.content as HTMLImageElement, 0, 0, layer.width, layer.height);

    canvas.toBlob((blob) => {
      if (blob) {
        this.backgroundRemovalService.removeBackground(blob as File).subscribe(
          (result: Blob) => {
            const url = URL.createObjectURL(result);
            const img = new Image();
            img.onload = () => {
              layer.content = img;
              this.redraw();
              URL.revokeObjectURL(url);
              this.isLoading = false;
            };
            img.src = url;
          },
          (error) => {
            console.error('Background removal failed:', error);
            this.isLoading = false;
            // Handle error (e.g., show a message to the user)
          }
        );
      }
    }, 'image/png');
  }

  setCanvasSize(preset: CanvasPreset): void {
    this.canvasWidth = preset.width;
    this.canvasHeight = preset.height;
    this.canvasRef.nativeElement.width = this.canvasWidth;
    this.canvasRef.nativeElement.height = this.canvasHeight;
    this.redraw();
  }

  drawRotateHandle(layer: Layer): void {
    const handleSize = 10;
    this.ctx.fillStyle = '#00f';
    this.ctx.fillRect(
      layer.x + layer.width - handleSize,
      layer.y + layer.height - handleSize,
      handleSize,
      handleSize
    );
  }

}