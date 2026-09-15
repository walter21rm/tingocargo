/**
 * PhoneField.jsx — Campo de teléfono con selector de país
 * Campo de teléfono con selector de país (bandera y código).
 * Validación automática según la cantidad de dígitos del país seleccionado.
 */
import { useEffect, useRef, useState } from "react";
import { getPhoneCountry, PHONE_COUNTRIES } from "../utils/phone.js";

const PhoneField = ({
  countryName = "telefonoPais",
  numberName = "telefonoNumero",
  countryValue,
  numberValue,
  onChange,
  label = "Telefono *",
  error = ""
}) => {
  const selectedCountry = getPhoneCountry(countryValue);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleOutside = (event) => {
      if (!wrapperRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const handleCountrySelect = (iso) => {
    onChange({ target: { name: countryName, value: iso } });
    setOpen(false);
  };

  const handleKeyDown = (event) => {
    const allowed = [
      "Backspace",
      "Delete",
      "ArrowLeft",
      "ArrowRight",
      "Tab",
      "Home",
      "End"
    ];
    if (allowed.includes(event.key)) return;
    if (!/^\d$/.test(event.key)) event.preventDefault();
  };
  return (
    <label className="text-sm text-slate-600">
      {label}
      <div className="mt-2 grid grid-cols-[170px_1fr] gap-2">
        <div className="relative" ref={wrapperRef}>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className={`flex w-full items-center justify-between rounded-xl border py-3 pl-3 pr-2 text-sm ${
              error ? "border-red-300" : "border-slate-200"
            }`}
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            <span className="inline-flex items-center gap-2 truncate">
              <img
                src={`https://flagcdn.com/20x15/${selectedCountry.iso.toLowerCase()}.png`}
                alt={`Bandera ${selectedCountry.name}`}
                className="h-[15px] w-[20px] rounded-sm"
                loading="lazy"
              />
              <span className="truncate">
                +{selectedCountry.dialCode} ({selectedCountry.name})
              </span>
            </span>
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 text-slate-500"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {open && (
            <div
              role="listbox"
              className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
            >
              {PHONE_COUNTRIES.map((country) => (
                <button
                  key={country.iso}
                  type="button"
                  onClick={() => handleCountrySelect(country.iso)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50 ${
                    country.iso === countryValue
                      ? "bg-slate-100 font-semibold text-slate-900"
                      : "text-slate-700"
                  }`}
                >
                  <img
                    src={`https://flagcdn.com/20x15/${country.iso.toLowerCase()}.png`}
                    alt={`Bandera ${country.name}`}
                    className="h-[15px] w-[20px] rounded-sm"
                    loading="lazy"
                  />
                  <span>
                    {country.iso} +{country.dialCode} ({country.name})
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <input
          name={numberName}
          value={numberValue}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={selectedCountry.digits}
          className={`w-full rounded-xl border px-4 py-3 text-sm ${
            error ? "border-red-300" : "border-slate-200"
          }`}
          placeholder={`Numero de ${selectedCountry.digits} digitos`}
          required
        />
      </div>
      {error ? (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      ) : (
        <span className="mt-1 block text-xs text-slate-400">
          Debe tener {selectedCountry.digits} digitos
        </span>
      )}
    </label>
  );
};

export default PhoneField;
