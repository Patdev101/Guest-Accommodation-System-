// Draws the guest accommodation flowcharts into any <svg id="f1".."f5"> on the page,
// and fills <span data-i="icon-name"> placeholders with icons.

const ICON = {
    bag: '<rect x="5" y="7" width="14" height="13" rx="2"/><path d="M9 7V4h6v3M9 20v2M15 20v2M10 11v5M14 11v5"/>',
    desk: '<circle cx="12" cy="6" r="3"/><path d="M6 14a6 6 0 0 1 12 0"/><path d="M3 14h18v7H3z"/>',
    form: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M8 11h8M8 15h5"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    id: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.6-1.4 1.7-2 3-2s2.4.6 3 2M14 10h4M14 14h3"/>',
    key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 21 2M15.5 7.5l3 3M18 5l3 3"/>',
    door: '<path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17M3 21h18"/><circle cx="15" cy="12" r="1"/>',
    laptop: '<rect x="4" y="4" width="16" height="11" rx="1.5"/><path d="M2 19h20l-2-4H4z"/>',
    cal: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    calcheck:
        '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m9 15.5 2 2 4-4"/>',
    calpick:
        '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    receipt:
        '<path d="M5 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    log: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    x: '<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    swap: '<path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"/>',
    bed: '<path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9"/>',
    sparkle:
        '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 16v5M16.5 18.5h5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M9.5 17V7h3.5a3 3 0 0 1 0 6H9.5M7.5 9.5h9M7.5 11h9"/>',
    wrench: '<path d="M14.5 3.5a5 5 0 0 0-6.2 6.2L3 15l6 6 5.3-5.3a5 5 0 0 0 6.2-6.2l-3 3-3-3z"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
    anchor: '<circle cx="12" cy="5" r="2.5"/><path d="M12 7.5V21M5 12H3a9 9 0 0 0 18 0h-2M8 11h8"/>',
};

const COL = { guest: '#0e97ab', reception: '#1f3c73', system: '#d08a0a' };
const INK = '#17253d',
    MUTED = '#5a6a82',
    LINE = '#8ea2bd',
    STROKE = '#d4ddea';
const KIND = {
    stop: { s: '#c53030', f: '#fdeeee', t: '#9b1c1c' },
    hold: { s: '#c47f0a', f: '#fdf4e3', t: '#7a4f00' },
    ok: { s: '#1e8e4e', f: '#e8f6ee', t: '#14683a' },
    link: { s: '#0e97ab', f: '#e8f7f9', t: '#0b6f7e', dash: '5 4' },
    status: { s: '#1f3c73', f: '#eaf0f8', t: '#1f3c73' },
    plain: { s: '#b7c4d6', f: '#ffffff', t: INK },
};

const esc = (s) =>
    String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

function ic(name, cx, cy, size, color, sw = 1.9) {
    const k = size / 24;
    return `<g transform="translate(${cx - size / 2} ${cy - size / 2}) scale(${k})" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${ICON[name]}</g>`;
}
function tx(
    x,
    y,
    s,
    { size = 12.5, weight = 650, fill = INK, anchor = 'middle' } = {},
) {
    return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(s)}</text>`;
}
// A block of bold lines followed by smaller muted lines, vertically centred on cy.
function block(x, cy, lines, sub, anchor, color) {
    const h = lines.length * 15 + sub.length * 13.5;
    let y = cy - h / 2 + 11,
        o = '';
    lines.forEach((l) => {
        o += tx(x, y, l, { fill: color, anchor });
        y += 15;
    });
    sub.forEach((l) => {
        o += tx(x, y, l, { size: 10.8, weight: 500, fill: MUTED, anchor });
        y += 13.5;
    });
    return o;
}
// Step card: coloured cap and icon show who acts; optional number badge on the top edge.
function card({ cx, cy, w = 120, h = 118, a, i, n, l = [], s = [] }) {
    const c = COL[a],
        x = cx - w / 2,
        y = cy - h / 2;
    let o =
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${c}"/>` +
        `<rect x="${x}" y="${y + 4}" width="${w}" height="${h - 4}" rx="12" fill="#fff"/>` +
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="none" stroke="${STROKE}"/>`;
    if (n !== undefined) {
        o +=
            `<circle cx="${cx}" cy="${y}" r="13" fill="${c}" stroke="#fff" stroke-width="2.5"/>` +
            tx(cx, y + 4.5, n, { weight: 800, fill: '#fff' });
    }
    o += ic(i, cx, y + 37, 28, c);
    let ly = y + 72;
    l.forEach((t) => {
        o += tx(cx, ly, t);
        ly += 16;
    });
    ly -= 1;
    s.forEach((t) => {
        o += tx(cx, ly, t, { size: 10.8, weight: 500, fill: MUTED });
        ly += 14;
    });
    return o;
}
function dia({ cx, cy, hw = 66, hh = 56, l = [], s = [] }) {
    return (
        `<polygon points="${cx - hw},${cy} ${cx},${cy - hh} ${cx + hw},${cy} ${cx},${cy + hh}" fill="#eef3fa" stroke="#1f3c73" stroke-width="1.6" stroke-linejoin="round"/>` +
        block(cx, cy, l, s, 'middle', '#1f3c73')
    );
}
function pill({ cx, cy, w, h = 56, k = 'plain', i, l = [], s = [] }) {
    const K = KIND[k],
        x = cx - w / 2,
        y = cy - h / 2;
    let o = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${K.f}" stroke="${K.s}" stroke-width="1.6"${K.dash ? ` stroke-dasharray="${K.dash}"` : ''}/>`;
    if (i)
        o += ic(i, x + 24, cy, 22, K.s) + block(x + 44, cy, l, s, 'start', K.t);
    else o += block(cx, cy, l, s, 'middle', K.t);
    return o;
}
function tile({ cx, cy, w = 150, h = 92, c, i, l, s }) {
    const x = cx - w / 2,
        y = cy - h / 2;
    return (
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${c}" fill-opacity=".10" stroke="${c}" stroke-width="1.6"/>` +
        ic(i, cx, y + 28, 26, c) +
        tx(cx, y + 60, l, { size: 13, weight: 750, fill: c }) +
        tx(cx, y + 77, s, { size: 11, weight: 500, fill: MUTED })
    );
}
function ed(d, m, { arrow = true, both = false } = {}) {
    return `<path d="${d}" fill="none" stroke="${LINE}" stroke-width="1.8" stroke-linejoin="round"${arrow ? ` marker-end="url(#${m})"` : ''}${both ? ` marker-start="url(#${m})"` : ''}/>`;
}
const yes = (x, y, a = 'middle') =>
    tx(x, y, 'Yes', { size: 11, weight: 700, fill: '#1e8e4e', anchor: a });
const no = (x, y, a = 'start') =>
    tx(x, y, 'No', { size: 11, weight: 700, fill: '#c53030', anchor: a });
const note = (x, y, s, a = 'middle') =>
    tx(x, y, s, { size: 11, weight: 500, fill: MUTED, anchor: a });

function draw(id, height, build) {
    const el = document.getElementById(id);
    if (!el) return;
    const m = 'arrow-' + id;
    el.setAttribute('viewBox', `0 0 1160 ${height}`);
    el.innerHTML =
        `<defs><marker id="${m}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${LINE}"/></marker></defs>` +
        build(m).join('');
}

// 1. Check-in (the ID is surrendered only once a room is confirmed)
draw('f1', 300, (m) => [
    ed('M132 110H157', m),
    ed('M277 110H302', m),
    ed('M422 110H447', m),
    ed('M567 110H592', m),
    yes(579, 101),
    ed('M712 110H737', m),
    yes(724, 101),
    ed('M857 110H882', m),
    ed('M1002 110H1027', m),
    ed('M507 166V222', m),
    no(516, 199),
    ed('M652 166V222', m),
    no(661, 199),
    ed('M1087 169V222', m),
    card({
        cx: 72,
        cy: 110,
        a: 'guest',
        i: 'bag',
        n: 1,
        l: ['Guest arrives', 'at clubhouse'],
    }),
    card({
        cx: 217,
        cy: 110,
        a: 'reception',
        i: 'desk',
        n: 2,
        l: ['Reception', 'attends guest'],
    }),
    card({
        cx: 362,
        cy: 110,
        a: 'guest',
        i: 'form',
        n: 3,
        l: ['Fill out', 'check-in form'],
        s: ['contact no. & pax'],
    }),
    dia({ cx: 507, cy: 110, hw: 60, l: ['Verified?'], s: ['internal check'] }),
    dia({
        cx: 652,
        cy: 110,
        hw: 60,
        l: ['Room ready?'],
        s: ['free or reserved'],
    }),
    card({
        cx: 797,
        cy: 110,
        a: 'guest',
        i: 'id',
        n: 4,
        l: ['Surrender', 'valid ID'],
        s: ['kept by reception'],
    }),
    card({
        cx: 942,
        cy: 110,
        a: 'reception',
        i: 'key',
        n: 5,
        l: ['Assign room', '& hand key'],
    }),
    card({
        cx: 1087,
        cy: 110,
        a: 'guest',
        i: 'door',
        n: 6,
        l: ['Proceed to', 'the room'],
    }),
    pill({
        cx: 462,
        cy: 250,
        w: 190,
        k: 'stop',
        i: 'x',
        l: ['Stop: cannot proceed'],
        s: ['attempt is logged'],
    }),
    pill({
        cx: 687,
        cy: 250,
        w: 200,
        k: 'link',
        i: 'cal',
        l: ['No room right now'],
        s: ['no ID taken; go to (2)'],
    }),
    pill({
        cx: 1087,
        cy: 250,
        w: 136,
        k: 'status',
        i: 'bed',
        l: ['OCCUPIED'],
        s: ['room status'],
    }),
]);

// 2. Reservation
draw('f2', 420, (m) => [
    ed('M140 100H168V160H195', m),
    ed('M140 270H168V210H195', m),
    ed('M315 185H354', m),
    ed('M486 185H519', m),
    yes(502, 176),
    ed('M420 241V286', m),
    no(429, 267),
    ed('M480 345H585V241', m),
    ed('M651 185H663V120H675', m),
    ed('M651 185H675', m),
    ed('M663 185V250H675', m),
    ed('M845 120H857V185', m, { arrow: false }),
    ed('M845 250H857V185', m, { arrow: false }),
    ed('M845 185H870', m),
    ed('M990 185H1019', m),
    ed('M1085 129V82', m),
    yes(1094, 112, 'start'),
    ed('M1085 241V292', m),
    no(1094, 268),
    card({
        cx: 80,
        cy: 100,
        a: 'guest',
        i: 'laptop',
        l: ['Guest books', 'online'],
        s: ['needs an account'],
    }),
    card({
        cx: 80,
        cy: 270,
        a: 'reception',
        i: 'desk',
        l: ['Reception books', 'for walk-in'],
        s: ['from check-in (1)'],
    }),
    card({
        cx: 255,
        cy: 185,
        a: 'system',
        i: 'cal',
        l: ['Show earliest', 'slot + calendar'],
    }),
    dia({ cx: 420, cy: 185, l: ['Earliest', 'slot OK?'] }),
    card({
        cx: 420,
        cy: 345,
        a: 'guest',
        i: 'calpick',
        l: ['Pick own', 'date & time'],
        s: ['open slots only'],
    }),
    dia({ cx: 585, cy: 185, l: ['Pay now?'], s: ['optional'] }),
    pill({ cx: 760, cy: 120, w: 170, h: 40, l: ['Full → PAID'] }),
    pill({ cx: 760, cy: 185, w: 170, h: 40, l: ['Downpayment → PARTIAL'] }),
    pill({ cx: 760, cy: 250, w: 170, h: 40, l: ['Pay later → UNPAID'] }),
    card({
        cx: 930,
        cy: 185,
        a: 'system',
        i: 'calcheck',
        l: ['Reservation', 'confirmed'],
        s: ['guest notified'],
    }),
    dia({ cx: 1085, cy: 185, l: ['Arrived', 'within 1 hr?'] }),
    pill({
        cx: 1070,
        cy: 58,
        w: 170,
        h: 48,
        k: 'link',
        l: ['Continue check-in (1)'],
    }),
    pill({
        cx: 1060,
        cy: 332,
        w: 190,
        h: 80,
        k: 'hold',
        l: ['After 1 hr: no-show'],
        s: ['reception releases the room', 'payments refunded'],
    }),
]);

// 3. Check-out reminder & extension
draw('f3', 320, (m) => [
    ed('M132 110H157', m),
    ed('M277 110H302', m),
    ed('M422 110H447', m),
    ed('M567 110H592', m),
    yes(579, 101),
    ed('M712 110H737', m),
    yes(724, 101),
    ed('M857 110H890', m),
    yes(873, 101),
    ed('M507 166V224', m),
    no(516, 199),
    ed('M652 166V224', m),
    no(661, 199),
    ed('M797 166V224', m),
    no(806, 199),
    card({
        cx: 72,
        cy: 110,
        a: 'system',
        i: 'clock',
        n: 1,
        l: ['1 hour before', 'check-out'],
        s: ['automatic'],
    }),
    card({
        cx: 217,
        cy: 110,
        a: 'system',
        i: 'bell',
        n: 2,
        l: ['Notify guest', '& reception'],
        s: ['in-app alerts'],
    }),
    card({
        cx: 362,
        cy: 110,
        a: 'reception',
        i: 'phone',
        n: 3,
        l: ['Reception', 'calls guest'],
        s: ['number on form'],
    }),
    dia({ cx: 507, cy: 110, hw: 60, l: ['Extending?'] }),
    dia({ cx: 652, cy: 110, hw: 60, l: ['Room reserved', 'next?'] }),
    dia({ cx: 797, cy: 110, hw: 60, l: ['Other room', 'for Guest B?'] }),
    pill({
        cx: 1005,
        cy: 110,
        w: 230,
        h: 86,
        k: 'hold',
        i: 'swap',
        l: ['Ask Guest B to move'],
        s: [
            'same time, other room',
            'agrees: extension allowed',
            'declines: extension denied',
        ],
    }),
    pill({
        cx: 507,
        cy: 260,
        w: 136,
        h: 72,
        k: 'link',
        l: ['Not extending'],
        s: ['room opens for booking', 'go to check-out (4)'],
    }),
    pill({
        cx: 652,
        cy: 260,
        w: 136,
        h: 72,
        k: 'ok',
        l: ['Allow extension'],
        s: ['new check-out time', 'availability updated'],
    }),
    pill({
        cx: 797,
        cy: 260,
        w: 136,
        h: 72,
        k: 'stop',
        l: ['Deny extension'],
        s: ['no room for Guest B', 'go to check-out (4)'],
    }),
]);

// 4. Check-out (check-out is recorded first; the room is inspected after the guest leaves)
draw('f4', 300, (m) => [
    ed('M118 116H139', m),
    ed('M247 116H268', m),
    ed('M376 116H397', m),
    ed('M505 116H524', m),
    ed('M636 116H655', m),
    yes(645, 107),
    ed('M763 116H782', m),
    ed('M894 116H913', m),
    yes(903, 107),
    ed('M1021 116H1042', m),
    ed('M580 60V22H967V57', m),
    no(588, 44),
    note(773, 16, 'nothing owed'),
    ed('M322 175V222', m),
    ed('M838 172V222', m),
    no(847, 199),
    ed('M933 254H967V175', m),
    note(975, 266, 'when settled', 'start'),
    card({
        cx: 64,
        cy: 116,
        w: 108,
        a: 'guest',
        i: 'user',
        n: 1,
        l: ['Report to', 'reception'],
    }),
    card({
        cx: 193,
        cy: 116,
        w: 108,
        a: 'reception',
        i: 'shield',
        n: 2,
        l: ['Check-out', 'verification'],
    }),
    card({
        cx: 322,
        cy: 116,
        w: 108,
        a: 'reception',
        i: 'log',
        n: 3,
        l: ['Record', 'check-out'],
        s: ['guest may leave'],
    }),
    card({
        cx: 451,
        cy: 116,
        w: 108,
        a: 'reception',
        i: 'search',
        n: 4,
        l: ['Room', 'inspection'],
    }),
    dia({ cx: 580, cy: 116, hw: 56, l: ['Damages or', 'charges?'] }),
    card({
        cx: 709,
        cy: 116,
        w: 108,
        a: 'reception',
        i: 'receipt',
        n: 5,
        l: ['Bill charges'],
        s: ['company (default)', 'or the guest'],
    }),
    dia({ cx: 838, cy: 116, hw: 56, l: ['Fully', 'paid?'] }),
    card({
        cx: 967,
        cy: 116,
        w: 108,
        a: 'reception',
        i: 'id',
        n: 6,
        l: ['Return', 'guest’s ID'],
    }),
    card({
        cx: 1096,
        cy: 116,
        w: 108,
        a: 'reception',
        i: 'sparkle',
        n: 7,
        l: ['Room to', 'cleaning'],
        s: ['or maintenance'],
    }),
    pill({
        cx: 322,
        cy: 254,
        w: 150,
        h: 64,
        k: 'status',
        i: 'search',
        l: ['INSPECTION'],
        s: ['room status'],
    }),
    pill({
        cx: 838,
        cy: 254,
        w: 190,
        h: 72,
        k: 'hold',
        i: 'lock',
        l: ['ID HELD'],
        s: ['until company or', 'guest settles'],
    }),
]);

// 5. Room status: the physical state of the room. Reservations are tracked separately,
// so an Occupied room can still carry a reservation for a later time.
draw('f5', 330, (m) => [
    ed('M172 110H255', m),
    note(213, 128, 'check-in'),
    ed('M405 110H488', m),
    ed('M638 110H722', m),
    ed('M872 110H955', m),
    ed('M1030 64V30H97V64', m),
    note(563, 23, 'reception marks cleaning done'),
    ed('M797 156V226', m),
    note(806, 196, 'repairs needed', 'start'),
    ed('M712 272H97V156', m, { both: true }),
    note(405, 265, 'reported issue / repair done'),
    tile({
        cx: 97,
        cy: 110,
        c: '#1e8e4e',
        i: 'bed',
        l: 'AVAILABLE',
        s: 'ready for a guest',
    }),
    tile({
        cx: 330,
        cy: 110,
        c: '#1f3c73',
        i: 'door',
        l: 'OCCUPIED',
        s: 'guest in room',
    }),
    tile({
        cx: 563,
        cy: 110,
        c: '#6b46c1',
        i: 'logout',
        l: 'CHECK-OUT',
        s: 'guest leaving',
    }),
    tile({
        cx: 797,
        cy: 110,
        c: '#c47f0a',
        i: 'search',
        l: 'INSPECTION',
        s: 'damages check',
    }),
    tile({
        cx: 1030,
        cy: 110,
        c: '#d9622b',
        i: 'sparkle',
        l: 'CLEANING',
        s: 'being cleaned',
    }),
    tile({
        cx: 797,
        cy: 272,
        w: 170,
        c: '#a6431a',
        i: 'wrench',
        l: 'UNDER MAINTENANCE',
        s: 'being repaired',
    }),
    tile({
        cx: 1030,
        cy: 272,
        c: '#5a6a82',
        i: 'ban',
        l: 'OUT OF SERVICE',
        s: 'admin: idle rooms only',
    }),
]);

// Icons in the HTML parts (header, rules, footer)
document.querySelectorAll('[data-i]').forEach((el) => {
    el.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICON[el.dataset.i]}</svg>`;
});
