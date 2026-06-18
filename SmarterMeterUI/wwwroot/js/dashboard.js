let allLabels = [];
let allValues = [];
let cumulativeChart;
let consumptionChart;

function initCharts(labels, values) {
    allLabels = labels;
    allValues = values;

    cumulativeChart = new Chart(document.getElementById('cumulativeChart').getContext('2d'), {
        type: 'line',
        data: { labels: [], datasets: [{ label: 'kWh', data: [], borderColor: 'rgb(25, 135, 84)', backgroundColor: 'rgba(25, 135, 84, 0.1)', fill: true, tension: 0.3, pointRadius: 0 }] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { type: 'time', time: { unit: 'day' }, ticks: { maxTicksLimit: 10 } },
                y: { ticks: { callback: val => val.toLocaleString() } }
            },
            plugins: { legend: { display: false } }
        }
    });

    consumptionChart = new Chart(document.getElementById('consumptionChart').getContext('2d'), {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'kWh', data: [], backgroundColor: 'rgba(25, 135, 84, 0.7)', borderColor: 'rgba(25, 135, 84, 1)', borderWidth: 1, barPercentage: 0.9, categoryPercentage: 1.0 }] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { type: 'category', ticks: { maxTicksLimit: 30 } },
                y: { ticks: { callback: val => val.toLocaleString() } }
            },
            plugins: { legend: { display: false } }
        }
    });

    filterCharts('month', document.querySelector('#rangeButtons .active'));
}

function filterCharts(range, btn) {
    const now = new Date();
    let cutoff;

    if (range === 'today') cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    else if (range === 'week') cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    else if (range === 'month') cutoff = new Date(now - 30 * 24 * 60 * 60 * 1000);
    else cutoff = null;

    const filtered = allLabels.map((l, i) => ({ l, v: allValues[i] }))
        .filter(d => !cutoff || new Date(d.l) >= cutoff);

    cumulativeChart.options.scales.x.time.unit = range === 'today' ? 'hour' : range === 'week' ? 'hour' : 'day';
    cumulativeChart.data.labels = filtered.map(d => d.l);
    cumulativeChart.data.datasets[0].data = filtered.map(d => d.v);
    cumulativeChart.update();

    if (range === 'today' || range === 'week') {
        const blockSize = range === 'today' ? 2 : 8;
        const blocks = {};
        const blockIsWeekend = {};

        for (let i = 1; i < filtered.length; i++) {
            const prev = new Date(filtered[i - 1].l);
            const curr = new Date(filtered[i].l);
            const gapHours = (curr - prev) / (1000 * 60 * 60);
            const slots = Math.max(1, Math.round(gapHours / 2)); // always divide by 2hr actual reading interval
            const totalConsumption = Math.max(0, +(filtered[i].v - filtered[i - 1].v).toFixed(3));
            const consumptionPerSlot = +(totalConsumption / slots).toFixed(3);

            for (let s = 0; s < slots; s++) {
                const slotTime = new Date(prev.getTime() + s * 2 * 60 * 60 * 1000);
                const isWeekend = slotTime.getDay() === 0 || slotTime.getDay() === 6;

                let label;
                if (range === 'today') {
                    const endHour = Math.floor(slotTime.getHours() / blockSize) * blockSize + blockSize;
                    const formatHour = h => h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;
                    label = `${formatHour(Math.floor(slotTime.getHours() / blockSize) * blockSize)}-${formatHour(endHour)}`;
                } else {
                    const startHour = Math.floor(slotTime.getHours() / blockSize) * blockSize;
                    const endHour = startHour + blockSize;
                    const formatHour = h => h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;
                    label = `${slotTime.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} ${formatHour(startHour)}-${formatHour(endHour)}`;
                }

                blocks[label] = (blocks[label] || 0) + consumptionPerSlot;
                blockIsWeekend[label] = isWeekend;
            }
        }

        const labels = Object.keys(blocks);
        consumptionChart.data.labels = labels;
        consumptionChart.data.datasets[0].data = Object.values(blocks).map(v => +v.toFixed(3));
        consumptionChart.data.datasets[0].backgroundColor = labels.map(l => blockIsWeekend[l] ? 'rgba(255, 193, 7, 0.7)' : 'rgba(25, 135, 84, 0.7)');
        consumptionChart.data.datasets[0].borderColor = labels.map(l => blockIsWeekend[l] ? 'rgba(255, 193, 7, 1)' : 'rgba(25, 135, 84, 1)');

    } else {
        const days = {};
        const dayIsWeekend = {};

        for (let i = 1; i < filtered.length; i++) {
            const d = new Date(filtered[i].l);
            const label = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
            const consumption = Math.max(0, +(filtered[i].v - filtered[i - 1].v).toFixed(3));
            days[label] = (days[label] || 0) + consumption;
            dayIsWeekend[label] = d.getDay() === 0 || d.getDay() === 6;
        }

        const labels = Object.keys(days);
        consumptionChart.data.labels = labels;
        consumptionChart.data.datasets[0].data = Object.values(days).map(v => +v.toFixed(3));
        consumptionChart.data.datasets[0].backgroundColor = labels.map(l => dayIsWeekend[l] ? 'rgba(255, 193, 7, 0.7)' : 'rgba(25, 135, 84, 0.7)');
        consumptionChart.data.datasets[0].borderColor = labels.map(l => dayIsWeekend[l] ? 'rgba(255, 193, 7, 1)' : 'rgba(25, 135, 84, 1)');
    }

    consumptionChart.update();

    if (btn) {
        document.querySelectorAll('#rangeButtons .btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
}