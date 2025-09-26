import {Component} from '@angular/core';
import * as XLSX from 'xlsx';
import {FormsModule} from '@angular/forms';
import {NgForOf, NgIf} from '@angular/common';


interface Registro {
  id: number;
  nombre: string;
  fecha: string;
  proyecto: string;
  actividad: string;
  totalHoras: number;
}

interface ResumenPersona {
  nombre: string;
  horasLaborales: number;
  horasRegistradas: number;
  horasSinActividades: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, NgForOf, NgIf],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})

export class AppComponent {
  titulo = 'Parser de Reportes';
  texto = '';
  proyecto = '';
  registros: Registro[] = [];
  registrosFiltrados: Registro[] = [];
  resumen: ResumenPersona[] = [];
  fechaInicio: string = '';
  fechaFin: string = '';

  procesarTexto() {
    const bloques = this.texto.split('Details');
    this.registros = [];
    let idCounter = 1;

    for (let bloque of bloques) {
      if (!bloque.trim()) {
        continue; // ignorar bloques vacíos
      }

      const actividadMatch = bloque.match(/^(Task|Bug)\s*#?\d+:.*$/m);
      const nombreMatch = bloque.match(/por\s+([\p{L}\s]+)\s+el|\spor\s+([\p{L}\s]+)\sen/iu);
      const fechaMatch = bloque.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s+(?:AM|PM))/);
      const horasMatch = bloque.match(/Spent time(?:\scambiado de.*a\s([\d.,]+)\s*horas?|:\s*([\d.,]+)\s*horas?)/i);

      if (actividadMatch && nombreMatch && fechaMatch && horasMatch) {
        const actividad = actividadMatch[0].trim();
        const nombre = (nombreMatch[1] || nombreMatch[2]).trim();
        const fecha = fechaMatch[1].trim();
        const totalHoras = parseFloat((horasMatch[1] || horasMatch[2]).replace(',', '.'));

        this.registros.push({
          id: idCounter++,
          nombre,
          fecha,
          proyecto: this.proyecto,
          actividad,
          totalHoras: parseFloat(totalHoras.toFixed(2))
        });
      }
    }

    this.filtrarPorFechas();
  }

  filtrarPorFechas() {
    if (!this.fechaInicio || !this.fechaFin) {
      this.registrosFiltrados = [...this.registros];
    } else {
      const inicio = new Date(this.fechaInicio);
      const fin = new Date(this.fechaFin);

      this.registrosFiltrados = this.registros.filter(r => {
        const fechaReg = new Date(r.fecha);
        return fechaReg >= inicio && fechaReg <= fin;
      });
    }

    this.calcularResumen();
  }

  calcularResumen() {
    const mapa = new Map<string, number>();

    for (let r of this.registrosFiltrados) {
      mapa.set(r.nombre, (mapa.get(r.nombre) || 0) + r.totalHoras);
    }

    this.resumen = Array.from(mapa.entries()).map(([nombre, horasRegistradas]) => {
      const horasLaborales = 40; // por defecto
      return {
        nombre,
        horasLaborales,
        horasRegistradas: parseFloat(horasRegistradas.toFixed(2)),
        horasSinActividades: parseFloat((horasLaborales - horasRegistradas).toFixed(2))
      };
    });
  }

  recalcularResumen() {
    this.resumen = this.resumen.map(p => ({
      ...p,
      horasRegistradas: parseFloat(p.horasRegistradas.toFixed(2)),
      horasSinActividades: parseFloat((p.horasLaborales - p.horasRegistradas).toFixed(2))
    }));
  }

  exportarExcel() {
    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(this.registrosFiltrados);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
    XLSX.writeFile(wb, 'reporte.xlsx');
  }
}
