const express = require('express');
const cors = require('cors');

const app = express();

// CORS ve JSON ayarları (Çok kritik)
app.use(cors({ origin: '*' }));
app.use(express.json());

const burclar = ['Koç','Boğa','İkizler','Yengeç','Aslan','Başak','Terazi','Akrep','Yay','Oğlak','Kova','Balık'];

const cityCoords = {
    "Adana":{lat:37.0000,lon:35.3213},"Ankara":{lat:39.9208,lon:32.8541},"Antalya":{lat:36.8969,lon:30.7133},
    "Bursa":{lat:40.1828,lon:29.0667},"Diyarbakır":{lat:37.9144,lon:40.2306},"Erzurum":{lat:39.9043,lon:41.2679},
    "Gaziantep":{lat:37.0662,lon:37.3833},"Istanbul":{lat:41.0082,lon:28.9784},"Izmir":{lat:38.4192,lon:27.1287},
    "Kayseri":{lat:38.7312,lon:35.4787},"Konya":{lat:37.8667,lon:32.4833},"Trabzon":{lat:41.0015,lon:39.7178}
    // API hafiflesin diye temel iller tutuldu, HTML zaten kendi içinde detaylı yedeğe sahip.
};

function getZodiacSign(deg) {
    return burclar[Math.floor(((deg % 360) + 360) % 360 / 30)];
}

// ANA ENDPOINT: HTML dosyasının beklediği /api/chart adresi
app.post('/api/chart', (req, res) => {
    try {
        const { year, month, day, hour, city } = req.body;
        
        if (!year || !month || !day || !hour) {
            return res.status(400).json({ error: "Eksik veri" });
        }

        const coords = cityCoords[city] || {lat:41.0082,lon:28.9784};
        const [h, m] = hour.split(':').map(Number);
        const h_utc = h - 3; // Türkiye saati
        
        let y = year, mn = month;
        if (mn <= 2) { y -= 1; mn += 12; }
        const A = Math.floor(y / 100);
        const B = (year > 1582 || (year === 1582 && month >= 10)) ? (2 - A + Math.floor(A/4)) : 0;
        const jd = Math.floor(365.25*(y+4716)) + Math.floor(30.6001*(mn+1)) + day + B - 1524.5 + (h_utc + m/60)/24;
        const d = jd - 2451545.0;
        const T = d / 36525.0;

        const degs = {};

        // Güneş
        const L0 = (280.46646 + 36000.76983*T) % 360;
        const M_sun = ((357.52911 + 35999.05029*T) % 360 + 360) % 360;
        const C_sun = (1.914602 - 0.004817*T)*Math.sin(M_sun*Math.PI/180) + (0.019993 - 0.000101*T)*Math.sin(2*M_sun*Math.PI/180);
        degs['Güneş'] = ((L0 + C_sun) % 360 + 360) % 360;

        // Ay
        const L_moon = ((218.3164477 + 481267.88123421*T - 0.0015786*T*T) % 360 + 360) % 360;
        const M_moon = ((134.9634114 + 477198.8676313*T + 0.0089970*T*T) % 360 + 360) % 360;
        const D_moon = ((297.8501921 + 445267.1114034*T - 0.0018819*T*T) % 360 + 360) % 360;
        const F_moon = ((93.2720950 + 483202.0175233*T - 0.0036539*T*T) % 360 + 360) % 360;
        const M2 = M_moon * Math.PI/180, D2 = D_moon * Math.PI/180, F2 = F_moon * Math.PI/180, Msun2 = M_sun * Math.PI/180;
        const dL = 6288774*Math.sin(M2) - 1274027*Math.sin(M2-2*D2) + 658314*Math.sin(2*D2) + 213618*Math.sin(2*M2) - 185116*Math.sin(Msun2);
        degs['Ay'] = ((L_moon + dL/1000000) % 360 + 360) % 360;

        // Düğümler ve Lilith
        degs['K.Düğüm'] = ((125.04452 - 1934.136261*T + 0.0020708*T*T) % 360 + 360) % 360;
        degs['Lilith'] = ((83.3532465 + 0.11140353*d) % 360 + 360) % 360;

        // Yükselen
        const GMST = ((280.46061837 + 360.98564736629*d) % 360 + 360) % 360;
        const LST = ((GMST + coords.lon) % 360 + 360) % 360;
        const e_rad = 23.4392911111 * Math.PI/180;
        const lat_r = coords.lat * Math.PI/180;
        const lst_r = LST * Math.PI/180;
        let asc = Math.atan2(Math.cos(lst_r), -Math.sin(lst_r)*Math.cos(e_rad) - Math.tan(lat_r)*Math.sin(e_rad)) * 180/Math.PI;
        degs['Yükselen'] = ((asc % 360) + 360) % 360;

        // Gezegenler
        const bodies = {
            'Merkür': {a:0.387098, e:0.205635, L0:252.250324, Ld:149474.0722, peri:77.4561},
            'Venüs':  {a:0.723330, e:0.006773, L0:181.979801, Ld:58519.2130, peri:131.5637},
            'Mars':   {a:1.523688, e:0.093405, L0:355.433275, Ld:19141.6964, peri:336.0409},
            'Jüpiter':{a:5.202561, e:0.048498, L0:34.351519,  Ld:3036.3027, peri:14.7539},
            'Satürn': {a:9.554747, e:0.055546, L0:50.077444,  Ld:1223.5095, peri:92.4315},
            'Uranüs': {a:19.21814, e:0.047318, L0:314.055005, Ld:428.4882, peri:170.9543},
            'Neptün': {a:30.10957, e:0.008606, L0:304.348665, Ld:218.4862, peri:44.9701},
            'Plüton': {a:39.48168, e:0.248808, L0:238.928881, Ld:145.2078, peri:224.0674},
            'Chiron': {a:13.67, e:0.383, L0:15.1, Ld:3.647, peri:339.0},
            'Juno':   {a:2.671, e:0.2564, L0:335.0, Ld:65.54, peri:247.0}
        };

        const R_e = 1.00014 - 0.01671*Math.cos(M_sun*Math.PI/180);
        const sunLon_r = degs['Güneş'] * Math.PI/180;
        const X_earth = R_e * Math.cos(sunLon_r + Math.PI);
        const Y_earth = R_e * Math.sin(sunLon_r + Math.PI);

        for (const b in bodies) {
            const bd = bodies[b];
            let L = ((bd.L0 + bd.Ld*(d/36525.0)) % 360 + 360) % 360;
            let M_b = ((L - bd.peri) % 360 + 360) % 360;
            let E = M_b * Math.PI/180;
            for (let i=0; i<5; i++) E = E + (M_b*Math.PI/180 - E + bd.e*Math.sin(E))/(1 - bd.e*Math.cos(E));
            const v = 2*Math.atan(Math.sqrt((1+bd.e)/(1-bd.e))*Math.tan(E/2))*180/Math.PI;
            const r = bd.a*(1 - bd.e*Math.cos(E));
            const l_h = ((v + bd.peri) % 360 + 360) % 360;
            const xh = r*Math.cos(l_h*Math.PI/180), yh = r*Math.sin(l_h*Math.PI/180);
            degs[b] = ((Math.atan2(yh-Y_earth, xh-X_earth)*180/Math.PI) % 360 + 360) % 360;
        }

        const planets = {};
        const order = ['Güneş','Ay','Yükselen','Merkür','Venüs','Mars','Jüpiter','Satürn','Uranüs','Neptün','Plüton','Chiron','Juno','Lilith','K.Düğüm'];
        order.forEach(k => { planets[k] = getZodiacSign(degs[k]); });
        
        // HTML'in beklediği formatta gönderiyoruz
        res.json({ planets, degrees: degs });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Vercel Serverless Function için dışa aktarma (CRITICAL)
module.exports = app;