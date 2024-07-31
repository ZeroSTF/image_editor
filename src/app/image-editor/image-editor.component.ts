import { Component, OnInit, ViewChild, ElementRef, HostListener } from '@angular/core';
import { Layer } from './layer.model';
import { RemoveBgService } from './remove-bg.service';
import { MatDialog } from '@angular/material/dialog';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { CanvasPresetsDialogComponent } from '../canvas-presets/canvas-presets.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatToolbarModule } from '@angular/material/toolbar';

@Component({
  selector: 'app-image-editor',
  templateUrl: './image-editor.component.html',
  styleUrls: ['./image-editor.component.css'],
  standalone: true,
  imports: [
    // Include all necessary Material imports here
    // For example:
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    FormsModule,
    CommonModule,
  ]
})
export class ImageEditorComponent implements OnInit {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('layersSidenav') layersSidenav!: MatSidenav;
  @ViewChild('propertiesSidenav') propertiesSidenav!: MatSidenav;

  private ctx!: CanvasRenderingContext2D;
  
  layers: Layer[] = [];
  selectedLayer: Layer | null = null;
  canvasWidth = 800;
  canvasHeight = 600;

  undoStack: Layer[][] = [];
  redoStack: Layer[][] = [];

  isDragging = false;
  isRotating = false;
  isResizing = false;
  dragStartX = 0;
  dragStartY = 0;
  rotationStartAngle = 0;
  resizeStartWidth = 0;
  resizeStartHeight = 0;

  isLoading = false;

  constructor(
    private backgroundRemovalService: RemoveBgService,
    private dialog: MatDialog
  ) { }

  ngOnInit(): void {
    this.ctx = this.canvasRef.nativeElement.getContext('2d')!;
    this.redraw();
  }

  toggleLayersPanel(): void {
    this.layersSidenav.toggle();
  }

  togglePropertiesPanel(): void {
    this.propertiesSidenav.toggle();
  }

  openPresetsDialog(): void {
    const dialogRef = this.dialog.open(CanvasPresetsDialogComponent, {
      width: '300px',
      data: { canvasWidth: this.canvasWidth, canvasHeight: this.canvasHeight }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.setCanvasSize(result.width, result.height);
      }
    });
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
    layer.fontSize = 24;
    layer.fontFamily = 'Arial';
    layer.color = '#000000';
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
    this.propertiesSidenav.open();
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
      this.ctx.rotate(layer.rotation * Math.PI / 180);
      this.ctx.translate(-(layer.x + layer.width / 2), -(layer.y + layer.height / 2));
      
      if (layer.type === 'image') {
        this.ctx.drawImage(layer.content as HTMLImageElement, layer.x, layer.y, layer.width, layer.height);
      } else if (layer.type === 'text') {
        this.ctx.font = `${layer.fontSize}px ${layer.fontFamily}`;
        this.ctx.fillStyle = layer.color;
        this.ctx.fillText(layer.content as string, layer.x, layer.y + layer.fontSize);
      }
      
      this.ctx.restore();
    });
    
    if (this.selectedLayer) {
      this.drawSelectionBorder(this.selectedLayer);
      this.drawRotateHandle(this.selectedLayer);
      this.drawResizeHandle(this.selectedLayer);
    }
  }

  drawSelectionBorder(layer: Layer): void {
    this.ctx.strokeStyle = '#00f';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(layer.x, layer.y, layer.width, layer.height);
  }

  drawRotateHandle(layer: Layer): void {
    const handleSize = 10;
    this.ctx.fillStyle = '#00f';
    this.ctx.fillRect(
      layer.x + layer.width / 2 - handleSize / 2,
      layer.y - handleSize - 5,
      handleSize,
      handleSize
    );
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
      } else if (this.isPointInResizeHandle(x, y, this.selectedLayer)) {
        this.isResizing = true;
        this.resizeStartWidth = this.selectedLayer.width;
        this.resizeStartHeight = this.selectedLayer.height;
        this.dragStartX = x;
        this.dragStartY = y;
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
      this.selectedLayer.rotation += (angle - this.rotationStartAngle) * (180 / Math.PI);
      this.rotationStartAngle = angle;
      this.redraw();
    } else if (this.isResizing && this.selectedLayer) {
      const dx = x - this.dragStartX;
      const dy = y - this.dragStartY;
      const aspectRatio = this.resizeStartWidth / this.resizeStartHeight;
      
      if (event.shiftKey) {
        // Maintain aspect ratio
        if (Math.abs(dx) > Math.abs(dy)) {
          this.selectedLayer.width = this.resizeStartWidth + dx;
          this.selectedLayer.height = this.selectedLayer.width / aspectRatio;
        } else {
          this.selectedLayer.height = this.resizeStartHeight + dy;
          this.selectedLayer.width = this.selectedLayer.height * aspectRatio;
        }
      } else {
        this.selectedLayer.width = this.resizeStartWidth + dx;
        this.selectedLayer.height = this.resizeStartHeight + dy;
      }
      
      this.redraw();
    } else {
      this.updateCursor(x, y);
    }
  }

  @HostListener('mouseup')
  onMouseUp(): void {
    if (this.isDragging || this.isRotating || this.isResizing) {
      this.isDragging = false;
      this.isRotating = false;
      this.isResizing = false;
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
    if (this.selectedLayer) {
      if (event.ctrlKey) {
        if (event.key === '+' || event.key === '=') {
          event.preventDefault();
          this.resizeSelectedLayer(1.1, true);
        } else if (event.key === '-') {
          event.preventDefault();
          this.resizeSelectedLayer(0.9, true);
        }
      } else {
        const moveDistance = event.shiftKey ? 10 : 1;
        switch (event.key) {
          case 'ArrowUp':
            event.preventDefault();
            this.selectedLayer.y -= moveDistance;
            break;
          case 'ArrowDown':
            event.preventDefault();
            this.selectedLayer.y += moveDistance;
            break;
          case 'ArrowLeft':
            event.preventDefault();
            this.selectedLayer.x -= moveDistance;
            break;
          case 'ArrowRight':
            event.preventDefault();
            this.selectedLayer.x += moveDistance;
            break;
        }
      }
      this.redraw();
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
    const handleX = layer.x + layer.width / 2 - handleSize / 2;
    const handleY = layer.y - handleSize - 5;
    return x >= handleX && x <= handleX + handleSize &&
           y >= handleY && y <= handleY + handleSize;
  }

  isPointInResizeHandle(x: number, y: number, layer: Layer): boolean {
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
        this.propertiesSidenav.open();
        this.redraw();
        return;
      }
    }
    this.selectedLayer = null;
    this.redraw();
  }

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent): void {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    if (x >= 0 && x <= this.canvasWidth && y >= 0 && y <= this.canvasHeight) {
      this.selectLayerAtPoint(x, y);
    }
  }

  updateCursor(x: number, y: number): void {
    if (this.selectedLayer) {
      if (this.isPointInRotateHandle(x, y, this.selectedLayer)) {
        this.canvasRef.nativeElement.style.cursor = 'grab';
      } else if (this.isPointInResizeHandle(x, y, this.selectedLayer)) {
        this.canvasRef.nativeElement.style.cursor = 'nwse-resize';
      } else if (this.isPointInLayer(x, y, this.selectedLayer)) {
        this.canvasRef.nativeElement.style.cursor = 'move';
      } else {
        this.canvasRef.nativeElement.style.cursor = 'default';
      }
    } else {
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
          }
        );
      }
    }, 'image/png');
  }

  setCanvasSize(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.canvasRef.nativeElement.width = width;
    this.canvasRef.nativeElement.height = height;
    this.redraw();
  }
}