import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { ImageEditorComponent } from './image-editor.component';

export default [
    {
        path: '',
        component: ImageEditorComponent,
    },
] as Routes;
