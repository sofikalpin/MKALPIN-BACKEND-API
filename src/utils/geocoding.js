const DEFAULT_HEADERS = {
  'User-Agent': process.env.GEOCODER_USER_AGENT || 'DesarrolloSoftwareCloud/1.0 (contacto@mkalpinni.com)',
  'Accept-Language': 'es'
};

const buildAddressString = ({ direccion, barrio, localidad, provincia }) => {
  const parts = [direccion, barrio, localidad, provincia]
    .map(part => (typeof part === 'string' ? part.trim() : ''))
    .filter((part, index, array) => part && array.indexOf(part) === index);

  return parts.join(', ');
};

const geocodeAddress = async ({ direccion, barrio, localidad, provincia }) => {
  const query = buildAddressString({ direccion, barrio, localidad, provincia });
  if (!query) {
    return null;
  }

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url, { headers: DEFAULT_HEADERS, method: 'GET' });

    if (!response.ok) {
      console.warn('Geocoding request failed:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    const { lat, lon } = data[0];
    const latitude = lat !== undefined ? parseFloat(lat) : null;
    const longitude = lon !== undefined ? parseFloat(lon) : null;

    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitud: latitude, longitud: longitude };
    }

    return null;
  } catch (error) {
    console.error('Error performing geocoding request:', error);
    return null;
  }
};

module.exports = {
  geocodeAddress,
  buildAddressString
};
