import {Component} from '@angular/core';
import {RouterOutlet} from '@angular/router';
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
  imports: [RouterOutlet, FormsModule, NgForOf, NgIf],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})

export class AppComponent {
  rawText: string = '';
  proyecto: string = '';
  registros: Registro[] = [];
  registrosFiltrados: Registro[] = [];
  resumen: ResumenPersona[] = [];

  fechaInicio: string = '';
  fechaFin: string = '';

  procesarTexto() {
    this.registros = [];
    const bloques = this.rawText.split('----').map(b => b.trim()).filter(b => b.length > 0);

    let idCounter = 1;

    for (let bloque of bloques) {
      const actividadMatch = bloque.match(/^(Task|Bug)\s*#\d+:[^\n\r]+/i);
      const actividad = actividadMatch ? actividadMatch[0].trim() : '';

      const nombreMatch = bloque.match(/por\s+([\wÁÉÍÓÚÑáéíóúüÜ]+\s[\wÁÉÍÓÚÑáéíóúüÜ]+(?:\s[\wÁÉÍÓÚÑáéíóúüÜ]+)*)\s+(?:en|el)/i);
      const nombre = nombreMatch ? nombreMatch[1].trim() : '';

      const fechaMatch = bloque.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s+(?:AM|PM))/i);
      const fecha = fechaMatch ? fechaMatch[1] : '';

      let totalHoras = 0;
      const horasMatch = bloque.match(/Spent time(?:\scambiado de.*a\s([\d.,]+)\s*horas?|:\s*([\d.,]+)\s*horas?)/i);
      if (horasMatch) {
        totalHoras = parseFloat((horasMatch[1] || horasMatch[2]).replace(',', '.'));
      }

      this.registros.push({
        id: idCounter++,
        nombre,
        fecha,
        proyecto: this.proyecto || 'SIN PROYECTO',
        actividad,
        totalHoras
      });
    }

    this.filtrarPorFechas();
  }

  filtrarPorFechas() {
    if (!this.fechaInicio && !this.fechaFin) {
      this.registrosFiltrados = [...this.registros];
    } else {
      this.registrosFiltrados = this.registros.filter(r => {
        const fecha = new Date(r.fecha);
        const inicio = this.fechaInicio ? new Date(this.fechaInicio) : null;
        const fin = this.fechaFin ? new Date(this.fechaFin) : null;

        if (inicio && fecha < inicio) return false;
        if (fin) {
          // sumamos 1 día al fin para incluirlo en el filtro
          const finAjustado = new Date(fin);
          finAjustado.setDate(finAjustado.getDate() + 1);
          if (fecha >= finAjustado) return false;
        }
        return true;
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
    const hoja = XLSX.utils.json_to_sheet(this.registrosFiltrados);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Actividades');

    const hojaResumen = XLSX.utils.json_to_sheet(this.resumen);
    XLSX.utils.book_append_sheet(libro, hojaResumen, 'Resumen por persona');

    XLSX.writeFile(libro, 'actividades.xlsx');
  }
}
