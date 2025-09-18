using System;
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
                    existente.InicioAtencion = horarioModel.InicioAtencion;
                    existente.FinAtencion = horarioModel.FinAtencion;
                    existente.InicioFeriado = horarioModel.InicioFeriado;
                    existente.FinFeriado = horarioModel.FinFeriado;
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
                InicioAtencion = horario.InicioAtencion,
                FinAtencion = horario.FinAtencion,
                InicioFeriado = horario.InicioFeriado,
                FinFeriado = horario.FinFeriado
            };
        }

        private static HorarioAtencionModel MapPayload(HorarioAtencionPayload payload, out string? error)
        {
            error = null;

            var inicioAtencion = NormalizarFecha(payload.InicioAtencion);
            var finAtencion = NormalizarFecha(payload.FinAtencion);

            if (finAtencion <= inicioAtencion)
            {
                error = "La fecha de fin debe ser posterior a la fecha de inicio.";
                return new HorarioAtencionModel();
            }

            if (!EsMultiploDeTreinta(inicioAtencion.TimeOfDay) || !EsMultiploDeTreinta(finAtencion.TimeOfDay))
            {
                error = "Las horas deben configurarse en intervalos de 30 minutos.";
                return new HorarioAtencionModel();
            }

            DateTime? inicioFeriado = null;
            DateTime? finFeriado = null;

            if (payload.InicioFeriado.HasValue || payload.FinFeriado.HasValue)
            {
                if (!payload.InicioFeriado.HasValue || !payload.FinFeriado.HasValue)
                {
                    error = "Para configurar un feriado debes indicar fecha de inicio y fin.";
                    return new HorarioAtencionModel();
                }

                inicioFeriado = NormalizarFecha(payload.InicioFeriado.Value);
                finFeriado = NormalizarFecha(payload.FinFeriado.Value);

                if (finFeriado <= inicioFeriado)
                {
                    error = "La fecha de fin del feriado debe ser posterior a la de inicio.";
                    return new HorarioAtencionModel();
                }

                if (inicioFeriado < inicioAtencion || finFeriado > finAtencion)
                {
                    error = "El rango de feriado debe estar comprendido dentro del horario de atención.";
                    return new HorarioAtencionModel();
                }

                if (!EsMultiploDeTreinta(inicioFeriado.Value.TimeOfDay) || !EsMultiploDeTreinta(finFeriado.Value.TimeOfDay))
                {
                    error = "Los horarios de feriado deben configurarse en intervalos de 30 minutos.";
                    return new HorarioAtencionModel();
                }
            }

            return new HorarioAtencionModel
            {
                InicioAtencion = inicioAtencion,
                FinAtencion = finAtencion,
                InicioFeriado = inicioFeriado,
                FinFeriado = finFeriado
            };
        }

        private static bool EsMultiploDeTreinta(TimeSpan time)
        {
            return time.TotalMinutes % 30 == 0;
        }

        private static DateTime NormalizarFecha(DateTime fecha)
        {
            if (fecha.Kind == DateTimeKind.Unspecified)
            {
                return fecha;
            }

            return DateTime.SpecifyKind(fecha, DateTimeKind.Unspecified);
        }
    }
}
