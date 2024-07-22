import { Routes } from '@angular/router';

export const routes: Routes = [
    {path: '', redirectTo: 'editor', pathMatch: 'full'},
    {path: 'editor', loadChildren: () => import('./image-editor/image-editor.routes')},
]