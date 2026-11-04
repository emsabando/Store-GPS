// STUB — replaced by the Sinking engineer (ARCHITECTURE.md §7).
export class SinkingDirector { constructor({ ship, bus }) { this.ship = ship; this.bus = bus; this.active = false; this.state = { minutesAfter: 0, trimDeg: 0, listDeg: 0, sinkM: 0, floodY: -20, broken: false, lightsOn: true, phase: 'idle' }; } start() { this.active = true; } update() {} setClockSpeed() {} }
