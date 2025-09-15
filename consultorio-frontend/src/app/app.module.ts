// src/app/app.module.ts
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { PacientesComponent } from './components/pacientes/pacientes.component';

@NgModule({
  declarations: [
    AppComponent,
    PacientesComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    ReactiveFormsModule,  // Para formularios reactivos
    FormsModule          // Para ngModel - ESTE ES IMPORTANTE
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }