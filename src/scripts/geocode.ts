import axios from 'axios';

interface LatLng {
    lat: number;
    lng: number;
}

export async function geocodeLocation(location: string): Promise<LatLng | null> {
    try {
        const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
            params: {
                address: `${location}, Greece`,
                key: process.env.GOOGLE_API_KEY
            }
        });

        if (response.data.status === 'OK' && response.data.results.length > 0) {
            const { lat, lng } = response.data.results[0].geometry.location;
            return { lat, lng };
        }

        return null;
    } catch (error) {
        console.error('Error geocoding location:', error);
        return null;
    }
}
