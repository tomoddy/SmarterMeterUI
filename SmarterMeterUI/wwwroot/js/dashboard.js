let allLabels = [];
let allValues = [];
let cumulativeChart;
let consumptionChart;

function initCharts(labels, values) {
    allLabels = labels;
    allValues = values;

    cumulativeChart = new Chart(document.getElementById('cumulativeChart').getContext('2d'), {
        type: 'line',
        data: { labels: [], datasets: [{ label: 'kWh', data: [], borderColor: 'rgb(25, 135, 84)', backgroundColor: 'rgba(25, 135, 84, 0.1)', fill: true, tension: 0.3, pointRadius: 0, spanGaps: true }] },
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
                x: { type: 'category', ticks: { maxTicksLimit: 31 } },
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

    const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysInPreviousMonth = new Date(firstOfThisMonth - 1).getDate();

    if (range === 'today') cutoff = new Date(now - 24 * 60 * 60 * 1000);
    else if (range === 'week') cutoff = new Date(now - 7 * 24 * 60 * 60 * 1000);
    else if (range === 'month') cutoff = new Date(now - daysInPreviousMonth * 24 * 60 * 60 * 1000);
    else if (range === 'year') cutoff = new Date(now - 365 * 24 * 60 * 60 * 1000);
    else cutoff = null;

    const filtered = allLabels.map((l, i) => ({ l, v: allValues[i] }))
        .filter(d => !cutoff || new Date(d.l) >= cutoff);

    cumulativeChart.options.scales.x.time.unit = range === 'today' ? 'hour' : range === 'week' ? 'day' : 'day';
    cumulativeChart.options.scales.x.time.displayFormats = range === 'today'
        ? { hour: 'ha' }
        : range === 'week'
            ? { day: 'dd MMM' }
            : { day: 'dd MMM' };

    // Find the last reading before the cutoff to use as the starting value
    let chartData = filtered;
    if (cutoff && allLabels.length > 0) {
        const beforeCutoff = allLabels
            .map((l, i) => ({ l, v: allValues[i] }))
            .filter(d => new Date(d.l) < cutoff);

        if (beforeCutoff.length > 0) {
            const lastBefore = beforeCutoff[beforeCutoff.length - 1];
            chartData = [{ l: cutoff.toISOString(), v: lastBefore.v }, ...filtered];
        } else if (filtered.length > 0) {
            chartData = [{ l: cutoff.toISOString(), v: filtered[0].v }, ...filtered];
        }
    }

    cumulativeChart.data.labels = chartData.map(d => d.l);
    cumulativeChart.data.datasets[0].data = chartData.map(d => d.v);
    cumulativeChart.update();

    const formatHour = h => {
        h = h % 24;
        return h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;
    };

    if (range === 'today') {
        const blockSize = 2;
        const blocks = {};
        const blockIsWeekend = {};

        const cutoffTime = new Date(now - 24 * 60 * 60 * 1000);
        const startBlock = Math.floor(cutoffTime.getHours() / 2) * 2;

        for (let i = 0; i < 12; i++) {
            const blockStart = (startBlock + i * 2) % 24;
            const blockDate = new Date(cutoffTime);
            blockDate.setHours(blockStart, 0, 0, 0);
            if (blockDate < cutoffTime) blockDate.setDate(blockDate.getDate() + 1);
            const label = `${formatHour(blockStart)}-${formatHour(blockStart + 2)}`;
            blocks[label] = 0;
            blockIsWeekend[label] = blockDate.getDay() === 0 || blockDate.getDay() === 6;
        }

        for (let i = 1; i < filtered.length; i++) {
            const prev = new Date(filtered[i - 1].l);
            const curr = new Date(filtered[i].l);
            const gapHours = (curr - prev) / (1000 * 60 * 60);
            const slots = Math.max(1, Math.round(gapHours / 2));
            const totalConsumption = Math.max(0, +(filtered[i].v - filtered[i - 1].v).toFixed(3));
            const consumptionPerSlot = +(totalConsumption / slots).toFixed(3);

            for (let s = 0; s < slots; s++) {
                const slotTime = new Date(prev.getTime() + s * 2 * 60 * 60 * 1000);
                const isWeekend = slotTime.getDay() === 0 || slotTime.getDay() === 6;
                const startHour = Math.floor(slotTime.getHours() / blockSize) * blockSize;
                const label = `${formatHour(startHour)}-${formatHour(startHour + blockSize)}`;
                if (label in blocks) {
                    blocks[label] += consumptionPerSlot;
                }
                blockIsWeekend[label] = isWeekend;
            }
        }

        const labels = Object.keys(blocks);
        consumptionChart.data.labels = labels;
        consumptionChart.data.datasets[0].data = Object.values(blocks).map(v => +v.toFixed(3));
        consumptionChart.data.datasets[0].backgroundColor = labels.map(l => blockIsWeekend[l] ? 'rgba(255, 193, 7, 0.7)' : 'rgba(25, 135, 84, 0.7)');
        consumptionChart.data.datasets[0].borderColor = labels.map(l => blockIsWeekend[l] ? 'rgba(255, 193, 7, 1)' : 'rgba(25, 135, 84, 1)');

    } else if (range === 'week') {
        const blockSize = 8;
        const blocks = {};
        const blockIsWeekend = {};

        const weekCutoff = new Date(now - 7 * 24 * 60 * 60 * 1000);
        const weekStartBlock = Math.floor(weekCutoff.getHours() / 8) * 8;

        for (let i = 0; i < 21; i++) {
            const blockStart = weekStartBlock + i * 8;
            const blockDate = new Date(weekCutoff);
            blockDate.setHours(0, 0, 0, 0);
            blockDate.setHours(blockDate.getHours() + blockStart);
            const blockEnd = new Date(blockDate.getTime() + 8 * 60 * 60 * 1000);
            if (blockEnd > now) break;
            const label = `${blockDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} ${formatHour(blockDate.getHours())}-${formatHour(blockDate.getHours() + 8)}`;
            blocks[label] = 0;
            blockIsWeekend[label] = blockDate.getDay() === 0 || blockDate.getDay() === 6;
        }

        for (let i = 1; i < filtered.length; i++) {
            const prev = new Date(filtered[i - 1].l);
            const curr = new Date(filtered[i].l);
            const gapHours = (curr - prev) / (1000 * 60 * 60);
            const slots = Math.max(1, Math.round(gapHours / 2));
            const totalConsumption = Math.max(0, +(filtered[i].v - filtered[i - 1].v).toFixed(3));
            const consumptionPerSlot = +(totalConsumption / slots).toFixed(3);

            for (let s = 0; s < slots; s++) {
                const slotTime = new Date(prev.getTime() + s * 2 * 60 * 60 * 1000);
                const isWeekend = slotTime.getDay() === 0 || slotTime.getDay() === 6;
                const startHour = Math.floor(slotTime.getHours() / blockSize) * blockSize;
                const label = `${slotTime.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} ${formatHour(startHour)}-${formatHour(startHour + blockSize)}`;
                if (label in blocks) {
                    blocks[label] += consumptionPerSlot;
                }
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

        if (range === 'year') {
            const weeks = {};

            // Pre-populate 52 weeks using Sunday-anchored week starts
            for (let i = 51; i >= 0; i--) {
                const d = new Date(now - i * 7 * 24 * 60 * 60 * 1000);
                const weekStart = new Date(d);
                weekStart.setDate(d.getDate() - d.getDay());
                weekStart.setHours(0, 0, 0, 0);
                const label = weekStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                weeks[label] = 0;
            }

            for (let i = 1; i < filtered.length; i++) {
                const d = new Date(filtered[i].l);
                const weekStart = new Date(d);
                weekStart.setDate(d.getDate() - d.getDay());
                weekStart.setHours(0, 0, 0, 0);
                const label = weekStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                const consumption = Math.max(0, +(filtered[i].v - filtered[i - 1].v).toFixed(3));
                if (label in weeks) {
                    weeks[label] += consumption;
                }
            }

            const labels = Object.keys(weeks);
            consumptionChart.data.labels = labels;
            consumptionChart.data.datasets[0].data = Object.values(weeks).map(v => +v.toFixed(3));
            consumptionChart.data.datasets[0].backgroundColor = 'rgba(25, 135, 84, 0.7)';
            consumptionChart.data.datasets[0].borderColor = 'rgba(25, 135, 84, 1)';
        } else {
            const dayCount = daysInPreviousMonth;

            for (let i = dayCount - 1; i >= 0; i--) {
                const d = new Date(now - i * 24 * 60 * 60 * 1000);
                const label = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                days[label] = 0;
                dayIsWeekend[label] = d.getDay() === 0 || d.getDay() === 6;
            }

            for (let i = 1; i < filtered.length; i++) {
                const d = new Date(filtered[i].l);
                const label = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                const consumption = Math.max(0, +(filtered[i].v - filtered[i - 1].v).toFixed(3));
                if (label in days) {
                    days[label] += consumption;
                }
                dayIsWeekend[label] = d.getDay() === 0 || d.getDay() === 6;
            }

            const labels = Object.keys(days);
            consumptionChart.data.labels = labels;
            consumptionChart.data.datasets[0].data = Object.values(days).map(v => +v.toFixed(3));
            consumptionChart.data.datasets[0].backgroundColor = labels.map(l => dayIsWeekend[l] ? 'rgba(255, 193, 7, 0.7)' : 'rgba(25, 135, 84, 0.7)');
            consumptionChart.data.datasets[0].borderColor = labels.map(l => dayIsWeekend[l] ? 'rgba(255, 193, 7, 1)' : 'rgba(25, 135, 84, 1)');
        }
    }

    consumptionChart.update();

    if (btn) {
        document.querySelectorAll('#rangeButtons .btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
}