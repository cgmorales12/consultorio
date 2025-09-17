using System.Globalization;
using ConsultorioMedico.API.Data;
using ConsultorioMedico.API.Models;
using ConsultorioMedico.API.Models.Dtos;
using ConsultorioMedico.API.Models.Requests;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ConsultorioMedico.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CitasController : ControllerBase
    {
        private static readonly (TimeSpan Inicio, TimeSpan Fin)[] JornadaLaboral = new[]
        {
            (new TimeSpan(8, 0, 0), new TimeSpan(11, 30, 0)),
            (new TimeSpan(14, 0, 0), new TimeSpan(17, 30, 0))
        };

        private readonly ConsultorioDbContext _context;
        private readonly ILogger<CitasController> _logger;

        public CitasController(ConsultorioDbContext context, ILogger<CitasController> logger)
        {
            _context = context;
            _logger = logger;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<CitaDto>>> ObtenerTodas()
        {
            var citas = await _context.Citas
                .Include(c => c.Paciente)
                .OrderBy(c => c.Fecha)
                .ThenBy(c => c.HoraInicio)
                .ToListAsync();

            return Ok(citas.Select(MapCita));
        }

        [HttpGet("{id:int}")]
        public async Task<ActionResult<CitaDto>> ObtenerPorId(int id)
        {
            var cita = await _context.Citas
                .Include(c => c.Paciente)
                .FirstOrDefaultAsync(c => c.CitaId == id);

            if (cita == null)
            {
                return NotFound();
            }

            return Ok(MapCita(cita));
        }

        [HttpGet("daily")]
        public async Task<ActionResult<IEnumerable<CitaDto>>> ObtenerPorDia([FromQuery] DateTime date)
        {
            var fecha = date.Date;

            var citas = await _context.Citas
                .Include(c => c.Paciente)
                .Where(c => c.Fecha.Date == fecha)
                .OrderBy(c => c.HoraInicio)
                .ToListAsync();

            return Ok(citas.Select(MapCita));
        }

        [HttpGet("weekly")]
        public async Task<ActionResult<IEnumerable<AgendaSemanalDiaDto>>> ObtenerPorSemana([FromQuery] DateTime startDate)
        {
            var inicioSemana = startDate.Date;
            var finSemana = inicioSemana.AddDays(7);

            var citasSemana = await _context.Citas
                .Include(c => c.Paciente)
                .Where(c => c.Fecha.Date >= inicioSemana && c.Fecha.Date < finSemana)
                .ToListAsync();

            var cultura = CultureInfo.GetCultureInfo("es-ES");
            var agenda = new List<AgendaSemanalDiaDto>();

            for (var i = 0; i < 7; i++)
            {
                var fecha = inicioSemana.AddDays(i);
                var nombreDia = cultura.DateTimeFormat.GetDayName(fecha.DayOfWeek);
                nombreDia = string.IsNullOrEmpty(nombreDia)
                    ? string.Empty
                    : char.ToUpper(nombreDia[0]) + nombreDia[1..];

                var citasDia = citasSemana
                    .Where(c => c.Fecha.Date == fecha.Date)
                    .OrderBy(c => c.HoraInicio)
                    .Select(MapCita)
                    .ToList();

                agenda.Add(new AgendaSemanalDiaDto
                {
                    Fecha = fecha,
                    Dia = nombreDia,
                    Citas = citasDia
                });
            }

            return Ok(agenda);
        }

        [HttpGet("stats")]
        public async Task<ActionResult<DailyStatsDto>> ObtenerEstadisticas([FromQuery] DateTime date)
        {
            var fecha = date.Date;

            var citas = await _context.Citas
                .Where(c => c.Fecha.Date == fecha)
                .ToListAsync();

            var horasOcupadas = citas
                .Select(c => (c.HoraFin - c.HoraInicio).TotalHours)
                .Where(horas => horas > 0)
                .Sum();

            var horasJornada = JornadaLaboral.Sum(rango => (rango.Fin - rango.Inicio).TotalHours);
            var horasDisponibles = Math.Max(0, horasJornada - horasOcupadas);

            var estadisticas = new DailyStatsDto
            {
                Fecha = fecha,
                Programadas = citas.Count(c => c.Estado == EstadoCita.Programada),
                Confirmadas = citas.Count(c => c.Estado == EstadoCita.Confirmada),
                EnCurso = citas.Count(c => c.Estado == EstadoCita.EnCurso),
                Completadas = citas.Count(c => c.Estado == EstadoCita.Completada),
                Total = citas.Count,
                HorasOcupadas = Math.Round(horasOcupadas, 2),
                HorasDisponibles = Math.Round(horasDisponibles, 2)
            };

            return Ok(estadisticas);
        }

        [HttpPost]
        public async Task<ActionResult<CitaDto>> Crear([FromBody] CitaPayload payload)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var paciente = await _context.Pacientes.FirstOrDefaultAsync(p => p.PacienteId == payload.PacienteId && p.Estado);
            if (paciente == null)
            {
                return BadRequest(new { message = "El paciente no existe o está inactivo." });
            }

            var horaInicio = ParseTime(payload.HoraInicio);
            var horaFin = ParseTime(payload.HoraFin);

            if (horaFin <= horaInicio)
            {
                return BadRequest(new { message = "La hora de fin debe ser mayor a la hora de inicio." });
            }

            var cita = new CitaModel
            {
                PacienteId = payload.PacienteId,
                Fecha = payload.Fecha.Date,
                HoraInicio = horaInicio,
                HoraFin = horaFin,
                Motivo = payload.Motivo,
                Notas = payload.Notas,
                Estado = EstadoCita.Programada,
                FechaCreacion = DateTime.Now
            };

            _context.Citas.Add(cita);
            await _context.SaveChangesAsync();

            await _context.Entry(cita).Reference(c => c.Paciente).LoadAsync();

            return CreatedAtAction(nameof(ObtenerPorId), new { id = cita.CitaId }, MapCita(cita));
        }

        [HttpPut("{id:int}")]
        public async Task<ActionResult<CitaDto>> Actualizar(int id, [FromBody] CitaPayload payload)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var cita = await _context.Citas
                .Include(c => c.Paciente)
                .FirstOrDefaultAsync(c => c.CitaId == id);

            if (cita == null)
            {
                return NotFound();
            }

            var paciente = await _context.Pacientes.FirstOrDefaultAsync(p => p.PacienteId == payload.PacienteId && p.Estado);
            if (paciente == null)
            {
                return BadRequest(new { message = "El paciente no existe o está inactivo." });
            }

            var horaInicio = ParseTime(payload.HoraInicio);
            var horaFin = ParseTime(payload.HoraFin);

            if (horaFin <= horaInicio)
            {
                return BadRequest(new { message = "La hora de fin debe ser mayor a la hora de inicio." });
            }

            cita.PacienteId = payload.PacienteId;
            cita.Fecha = payload.Fecha.Date;
            cita.HoraInicio = horaInicio;
            cita.HoraFin = horaFin;
            cita.Motivo = payload.Motivo;
            cita.Notas = payload.Notas;

            await _context.SaveChangesAsync();

            await _context.Entry(cita).Reference(c => c.Paciente).LoadAsync();

            return Ok(MapCita(cita));
        }

        [HttpPut("{id:int}/estado")]
        public async Task<ActionResult<CitaDto>> ActualizarEstado(int id, [FromBody] ActualizarEstadoCitaRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var cita = await _context.Citas
                .Include(c => c.Paciente)
                .FirstOrDefaultAsync(c => c.CitaId == id);

            if (cita == null)
            {
                return NotFound();
            }

            if (!Enum.TryParse<EstadoCita>(request.Estado, ignoreCase: true, out var nuevoEstado))
            {
                return BadRequest(new { message = "El estado proporcionado no es válido." });
            }

            cita.Estado = nuevoEstado;
            await _context.SaveChangesAsync();

            return Ok(MapCita(cita));
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Eliminar(int id)
        {
            var cita = await _context.Citas.FindAsync(id);
            if (cita == null)
            {
                return NotFound();
            }

            _context.Citas.Remove(cita);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private static CitaDto MapCita(CitaModel cita)
        {
            return new CitaDto
            {
                CitaId = cita.CitaId,
                PacienteId = cita.PacienteId,
                PacienteNombre = cita.Paciente != null ? $"{cita.Paciente.Nombres} {cita.Paciente.Apellidos}" : string.Empty,
                Fecha = cita.Fecha.Date,
                HoraInicio = FormatearHora(cita.HoraInicio),
                HoraFin = FormatearHora(cita.HoraFin),
                Estado = cita.Estado.ToString(),
                Motivo = cita.Motivo,
                Notas = cita.Notas
            };
        }

        private static TimeSpan ParseTime(string value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return TimeSpan.Zero;
            }

            if (TimeSpan.TryParse(value, out var resultado))
            {
                return resultado;
            }

            throw new FormatException($"No se pudo interpretar la hora '{value}'.");
        }

        private static string FormatearHora(TimeSpan hora)
        {
            return new DateTime(hora.Ticks).ToString("HH:mm");
        }
    }
}
