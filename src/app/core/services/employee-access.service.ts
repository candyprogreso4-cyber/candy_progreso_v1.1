import { Injectable, inject, signal } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';
import { ToastService } from './toast.service';
import { Employee } from '../models/pos.types';

@Injectable({
  providedIn: 'root',
})
export class EmployeeAccessService {
  private readonly supabase = inject(SupabaseClientService).instance;
  private readonly toast = inject(ToastService);

  readonly employees = signal<Employee[]>([]);
  readonly isLoading = signal(false);

  async loadEmployees(): Promise<Employee[]> {
    try {
      const { data, error } = await this.supabase
        .from('employees')
        .select('id, identification, full_name, is_active, created_at')
        .neq('identification', 'SALON-COMPARTIDO')
        .order('full_name', { ascending: true });

      if (error) throw error;

      const list: Employee[] = (data || []).map((e) => ({
        id: e.id,
        identification: e.identification,
        full_name: e.full_name,
        is_active: e.is_active,
        created_at: e.created_at,
      }));

      this.employees.set(list);
      return list;
    } catch (err) {
      console.warn('Error al cargar empleados:', err);
      return [];
    }
  }

  async createEmployee(emp: Partial<Employee>): Promise<boolean> {
    this.isLoading.set(true);
    try {
      const { error } = await this.supabase.rpc('create_reference_employee', {
        p_identification: emp.identification ?? '',
        p_full_name: emp.full_name ?? '',
      });

      if (error) throw error;

      this.toast.success(`Empleado "${emp.full_name}" registrado.`);
      await this.loadEmployees();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrar empleado.';
      this.toast.error(msg);
      return false;
    } finally {
      this.isLoading.set(false);
    }
  }

  async toggleEmployeeStatus(id: string, currentStatus: boolean): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('employees')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      await this.loadEmployees();
      this.toast.info('Estado de empleado actualizado.');
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error actualizando empleado.';
      this.toast.error(msg);
      return false;
    }
  }

}
