import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogContent, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatListItem, MatNavList } from '@angular/material/list';

interface CanvasPreset {
  name: string;
  width: number;
  height: number;
}

@Component({
  selector: 'app-canvas-presets-dialog',
  standalone: true,
  imports: [MatDialogModule, MatDialogContent, MatNavList, MatListItem, CommonModule],

  template: `
    <h2 mat-dialog-title>Canvas Presets</h2>
    <mat-dialog-content>
      <mat-nav-list>
        <mat-list-item *ngFor="let preset of presets" (click)="selectPreset(preset)">
          {{ preset.name }} ({{ preset.width }}x{{ preset.height }})
        </mat-list-item>
      </mat-nav-list>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button mat-button (click)="onNoClick()">Cancel</button>
    </mat-dialog-actions>
  `
})
export class CanvasPresetsDialogComponent {
  presets: CanvasPreset[] = [
    { name: 'Facebook Post', width: 1200, height: 630 },
    { name: 'Instagram Post', width: 1080, height: 1080 },
    { name: 'Twitter Post', width: 1024, height: 512 },
    { name: 'LinkedIn Post', width: 1200, height: 627 },
    { name: 'YouTube Thumbnail', width: 1280, height: 720 },
    { name: 'A4 Portrait', width: 2480, height: 3508 },
    { name: 'A4 Landscape', width: 3508, height: 2480 },
  ];

  constructor(
    public dialogRef: MatDialogRef<CanvasPresetsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { canvasWidth: number, canvasHeight: number }
  ) {}

  onNoClick(): void {
    this.dialogRef.close();
  }

  selectPreset(preset: CanvasPreset): void {
    this.dialogRef.close(preset);
  }
}
