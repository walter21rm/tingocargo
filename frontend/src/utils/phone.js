/**
 * ============================================================
 * phone.js — Utilidades de validación telefónica internacional
 * ============================================================
 * Maneja la validación, construcción y parseo de números de
 * teléfono en formato E.164 (+código+número).
 *
 * Los países soportados se definen en config.json y se pueden
 * actualizar dinámicamente con loadCountriesFromConfig().
 * ============================================================
 */

/** Banderas emoji por código ISO (para mostrar en el selector de país) */
const FLAGS = {
  PE: "🇵🇪", CL: "🇨🇱", CO: "🇨🇴", EC: "🇪🇨", MX: "🇲🇽",
  US: "🇺🇸", BO: "🇧🇴", AR: "🇦🇷", BR: "🇧🇷"
};

/** Lista de países (valores por defecto, se actualizan con loadCountriesFromConfig) */
export let PHONE_COUNTRIES = [
  { iso: "PE", name: "Peru", flag: "🇵🇪", dialCode: "51", digits: 9 },
  { iso: "CL", name: "Chile", flag: "🇨🇱", dialCode: "56", digits: 9 },
  { iso: "CO", name: "Colombia", flag: "🇨🇴", dialCode: "57", digits: 10 },
  { iso: "EC", name: "Ecuador", flag: "🇪🇨", dialCode: "593", digits: 9 },
  { iso: "MX", name: "Mexico", flag: "🇲🇽", dialCode: "52", digits: 10 },
  { iso: "US", name: "Estados Unidos", flag: "🇺🇸", dialCode: "1", digits: 10 },
  { iso: "BO", name: "Bolivia", flag: "🇧🇴", dialCode: "591", digits: 8 },
  { iso: "AR", name: "Argentina", flag: "🇦🇷", dialCode: "54", digits: 10 },
  { iso: "BR", name: "Brasil", flag: "🇧🇷", dialCode: "55", digits: 11 }
];

export let DEFAULT_PHONE_COUNTRY = "PE";

/**
 * Carga los países desde la configuración pública del backend (config.json).
 * Se llama una vez al iniciar la app. Si falla, se mantienen los valores por defecto.
 */
export const loadCountriesFromConfig = (telefonosConfig) => {
  if (!telefonosConfig) return;
  if (telefonosConfig.paisPorDefecto) {
    DEFAULT_PHONE_COUNTRY = telefonosConfig.paisPorDefecto;
  }
  if (Array.isArray(telefonosConfig.paises) && telefonosConfig.paises.length > 0) {
    PHONE_COUNTRIES = telefonosConfig.paises.map((p) => ({
      iso: p.iso,
      name: p.nombre,
      flag: FLAGS[p.iso] || "🏳️",
      dialCode: p.dialCode,
      digits: p.digits
    }));
  }
};

export const onlyDigits = (value) => String(value || "").replace(/\D/g, "");

export const getPhoneCountry = (iso) =>
  PHONE_COUNTRIES.find((country) => country.iso === iso) || PHONE_COUNTRIES[0];

/** Valida que un número tenga la cantidad correcta de dígitos según el país */
export const validatePhone = (countryIso, number) => {
  const country = getPhoneCountry(countryIso);
  const digits = onlyDigits(number);
  if (!digits) {
    return { ok: false, error: "El teléfono es obligatorio." };
  }
  if (digits.length !== country.digits) {
    return {
      ok: false,
      error: `El teléfono para ${country.name} debe tener ${country.digits} dígitos.`
    };
  }
  return { ok: true, digits, country };
};

/** Construye un número en formato E.164 (ej: +51987654321). Retorna { ok, e164, local, country }. */
export const buildPhoneValue = (countryIso, number) => {
  const validation = validatePhone(countryIso, number);
  if (!validation.ok) return validation;
  const { country, digits } = validation;
  return {
    ok: true,
    e164: `+${country.dialCode}${digits}`,
    local: digits,
    country
  };
};

/** Separa un número E.164 en { countryIso, number }. Útil para pre-llenar formularios de edición. */
export const splitPhoneValue = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return { countryIso: DEFAULT_PHONE_COUNTRY, number: "" };
  const digits = onlyDigits(raw);
  for (const country of PHONE_COUNTRIES) {
    if (digits.startsWith(country.dialCode)) {
      const local = digits.slice(country.dialCode.length);
      if (local.length === country.digits) {
        return { countryIso: country.iso, number: local };
      }
    }
  }
  return { countryIso: DEFAULT_PHONE_COUNTRY, number: digits };
};
