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
        public async Task<ActionResult<HorarioAtencionDto>> Obtener()
        {
            var horario = await _context.HorariosAtencion.AsNoTracking().FirstOrDefaultAsync();

            if (horario == null)
            {
                return NotFound();
            }

            return Ok(MapHorario(horario));
        }

        [HttpPut]
        public async Task<ActionResult<HorarioAtencionDto>> Actualizar([FromBody] ActualizarHorarioAtencionRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var horarioModel = MapPayload(request.Horario, out var error);
            if (!string.IsNullOrEmpty(error))
            {
                ModelState.AddModelError(nameof(HorarioAtencionPayload), error!);
                return BadRequest(ModelState);
            }

            try
            {
                var existente = await _context.HorariosAtencion.FirstOrDefaultAsync();
                if (existente == null)
                {
                    await _context.HorariosAtencion.AddAsync(horarioModel);
                }
                else
                {
                    existente.DiaInicio = horarioModel.DiaInicio;
                    existente.HoraInicio = horarioModel.HoraInicio;
                    existente.DiaFin = horarioModel.DiaFin;
                    existente.HoraFin = horarioModel.HoraFin;
                    _context.HorariosAtencion.Update(existente);
                }

                await _context.SaveChangesAsync();

                var resultado = existente ?? horarioModel;
                return Ok(MapHorario(resultado));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al actualizar el horario de atención.");
                return StatusCode(500, new { message = "No se pudo actualizar el horario de atención." });
            }
        }

        private static HorarioAtencionDto MapHorario(HorarioAtencionModel horario)
        {
            return new HorarioAtencionDto
            {
                HorarioAtencionId = horario.HorarioAtencionId,
                DiaInicio = (int)horario.DiaInicio,
                HoraInicio = FormatearHora(horario.HoraInicio),
                DiaFin = (int)horario.DiaFin,
                HoraFin = FormatearHora(horario.HoraFin)
            };
        }

        private static HorarioAtencionModel MapPayload(HorarioAtencionPayload payload, out string? error)
        {
            error = null;

            if (payload.DiaInicio < 0 || payload.DiaInicio > 6)
            {
                error = "El día de inicio es inválido.";
                return new HorarioAtencionModel();
            }

            if (payload.DiaFin < 0 || payload.DiaFin > 6)
            {
                error = "El día de fin es inválido.";
                return new HorarioAtencionModel();
            }

            if (payload.DiaFin < payload.DiaInicio)
            {
                error = "El día de fin debe ser mayor o igual al día de inicio.";
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

            if (!EsMultiploDeTreinta(horaInicio) || !EsMultiploDeTreinta(horaFin))
            {
                error = "Las horas deben configurarse en intervalos de 30 minutos.";
                return new HorarioAtencionModel();
            }

            if (horaFin <= horaInicio)
            {
                error = "La hora de fin debe ser mayor a la hora de inicio.";
                return new HorarioAtencionModel();
            }

            return new HorarioAtencionModel
            {
                DiaInicio = (DayOfWeek)payload.DiaInicio,
                HoraInicio = horaInicio,
                DiaFin = (DayOfWeek)payload.DiaFin,
                HoraFin = horaFin
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

        private static string FormatearHora(TimeSpan hora)
        {
            return new DateTime(hora.Ticks).ToString("HH:mm");
        }
    }
}
