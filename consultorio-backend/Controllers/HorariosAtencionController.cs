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
    public class HorariosAtencionController : ControllerBase
    {
        private readonly ConsultorioDbContext _context;
        private readonly ILogger<HorariosAtencionController> _logger;

        public HorariosAtencionController(ConsultorioDbContext context, ILogger<HorariosAtencionController> logger)
        {
            _context = context;
            _logger = logger;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<HorarioAtencionDto>>> ObtenerTodos()
        {
            var horarios = await _context.HorariosAtencion
                .OrderBy(h => h.DiaSemana)
                .ThenBy(h => h.HoraInicio)
                .ToListAsync();

            return Ok(horarios.Select(MapHorario));
        }

        [HttpPut]
        public async Task<ActionResult<IEnumerable<HorarioAtencionDto>>> Actualizar([FromBody] ActualizarHorariosAtencionRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var modelos = new List<HorarioAtencionModel>();

            foreach (var payload in request.Horarios)
            {
                var horario = MapPayload(payload, out var error);
                if (!string.IsNullOrEmpty(error))
                {
                    ModelState.AddModelError(nameof(HorarioAtencionPayload), error!);
                    return BadRequest(ModelState);
                }

                modelos.Add(horario);
            }

            if (TieneTraslapes(modelos))
            {
                return BadRequest(new { message = "Los horarios no pueden traslaparse en el mismo día." });
            }

            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                var existentes = await _context.HorariosAtencion.ToListAsync();
                _context.HorariosAtencion.RemoveRange(existentes);
                await _context.SaveChangesAsync();

                await _context.HorariosAtencion.AddRangeAsync(modelos);
                await _context.SaveChangesAsync();

                await transaction.CommitAsync();
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Error al actualizar los horarios de atención.");
                return StatusCode(500, new { message = "No se pudieron actualizar los horarios de atención." });
            }

            return Ok(modelos.OrderBy(h => h.DiaSemana).ThenBy(h => h.HoraInicio).Select(MapHorario));
        }

        private static HorarioAtencionDto MapHorario(HorarioAtencionModel horario)
        {
            return new HorarioAtencionDto
            {
                HorarioAtencionId = horario.HorarioAtencionId,
                DiaSemana = horario.DiaSemana,
                HoraInicio = FormatearHora(horario.HoraInicio),
                HoraFin = FormatearHora(horario.HoraFin),
                Activo = horario.Activo
            };
        }

        private static HorarioAtencionModel MapPayload(HorarioAtencionPayload payload, out string? error)
        {
            error = null;

            if (payload.DiaSemana < 0 || payload.DiaSemana > 6)
            {
                error = "El día de la semana es inválido.";
                return new HorarioAtencionModel();
            }

            TimeSpan horaInicio;
            TimeSpan horaFin;

            try
            {
                horaInicio = ParseTime(payload.HoraInicio);
                horaFin = ParseTime(payload.HoraFin);
            }
            catch (FormatException ex)
            {
                error = ex.Message;
                return new HorarioAtencionModel();
            }

            if (horaFin <= horaInicio)
            {
                error = "La hora de fin debe ser mayor a la hora de inicio.";
                return new HorarioAtencionModel();
            }

            if (!EsMultiploDeTreinta(horaInicio) || !EsMultiploDeTreinta(horaFin))
            {
                error = "Las horas deben configurarse en intervalos de 30 minutos.";
                return new HorarioAtencionModel();
            }

            return new HorarioAtencionModel
            {
                DiaSemana = (DayOfWeek)payload.DiaSemana,
                HoraInicio = horaInicio,
                HoraFin = horaFin,
                Activo = payload.Activo
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

        private static bool EsMultiploDeTreinta(TimeSpan time)
        {
            return time.TotalMinutes % 30 == 0;
        }

        private static bool TieneTraslapes(IEnumerable<HorarioAtencionModel> horarios)
        {
            return horarios
                .Where(h => h.Activo)
                .GroupBy(h => h.DiaSemana)
                .Any(grupo =>
                {
                    var ordenados = grupo.OrderBy(h => h.HoraInicio).ToList();
                    for (var i = 1; i < ordenados.Count; i++)
                    {
                        if (ordenados[i].HoraInicio < ordenados[i - 1].HoraFin)
                        {
                            return true;
                        }
                    }

                    return false;
                });
        }

        private static string FormatearHora(TimeSpan hora)
        {
            return new DateTime(hora.Ticks).ToString("HH:mm");
        }
    }
}
