---
title: "Smart Water Management System (DIY)"
date: 2025-07-12
tags: [esphome, home-assistant, esp32, diy, water]
images: [/img/smart-water-management/prototype.jpg]
---

*(The full ESPHome config and wiring live in [lejmr/dyi-ha-water-management](https://github.com/lejmr/dyi-ha-water-management).)*

I have a 16m³ underground concrete rain water tank, a well, and a cellar that sits uncomfortably close to both. When the groundwater rises, it finds its way through the concrete and into the cellar — so I wanted a system that watches both water levels and runs the pump *before* the water starts redecorating. And since it irrigates the lawn anyway, the water doesn't even go to waste.

The requirements I set myself: DIN rail mount (three positions max, power supply included), reliability, minimal maintenance — and everything visible in Home Assistant, because a water level I can't chart might as well not exist.

## Off-the-shelf first

I did try to buy my way out of it. [Lovato LVM40A127](https://catalogue.lovatoelectric.com/cz_cs/Hladinova-rele-Modularni-verze-Jednonapetova-rele-Multifunkcni-Automaticky-reset-Napajeci-napeti-110-127VAC/LVM40A127/snp) and [Elko HRH-6](https://www.elkoep.cz/hladinovy-spinac---hrh-6) both do the job functionally — but neither speaks Home Assistant, and a dumb relay was exactly what I didn't want. So: DIY.

## The build

[ESPHome](https://esphome.io) was the obvious software choice — native Home Assistant integration, config in one YAML file. For sensing I picked [RS-485 water level transmitters](https://www.aliexpress.com/item/1005006071143565.html) (the 24V DC version), on the strength of recommendations from various DIY forums.

The rest of the hardware follows from that decision: a [Wemos S2 mini](https://www.wemos.cc/en/latest/s2/s2_mini.html) ESP32 board, a [MAX485 converter](https://www.aliexpress.com/item/1005006071143565.html) because ESP boards don't speak RS-485, a [24V→5V step-down](https://dratek.cz/arduino/1738-step-down-modul-napajeni-mini-buck-nastavitelny.html) to power the logic, all soldered onto a universal [prototyping board](https://www.aliexpress.com/item/1005008742636890.html) and packed into a [SZOMK DIN rail enclosure](https://www.aliexpress.com/item/1005006067012648.html).

![Wiring](/img/smart-water-management/wiring.png)
![Initial solution](/img/smart-water-management/testing.jpg)
![Prototype](/img/smart-water-management/prototype.jpg)

Prototype ready for deployment:

![Final test](/img/smart-water-management/final-preparation.jpg)

The ESP board's configuration lives in [`wemos.yml`](https://github.com/lejmr/dyi-ha-water-management/blob/master/wemos.yml) and gets flashed like this:

```shell
esphome run --device /dev/tty.usbmodem01 wemos.yml
```

The final deployment ended up in two places: the wiring cabinet and the well itself.

![Deployment in wiring deck](/img/smart-water-management/deployment.jpg)
![Deployment in well](/img/smart-water-management/well.jpeg)

The pump itself is powered through a [Shelly 1PM gen4](https://kb.shelly.cloud/knowledge-base/shelly-1pm-gen4), driven by a Home Assistant automation: when the well level climbs above 190 cm, switch on; wait until it drops below 140 cm, switch off.

```yaml
alias: Reduce level in the well
triggers:
  - trigger: device
    type: value
    entity_id: sensor.well_level
    above: 190
actions:
  - type: turn_on
    entity_id: switch.well_pump
  - wait_for_trigger:
      - trigger: device
        type: value
        entity_id: sensor.well_level
        below: 140
  - type: turn_off
    entity_id: switch.well_pump
mode: single
```

## How it holds up

- The water level sensor is very accurate — genuinely surprised for the price.
- The whole setup (2x RS-485 converter, 1x level sensor) consumes about 1 W while reading every 5 seconds.

![Graphs in Home Assistant](/img/smart-water-management/ha.png)

## Challenges

One mystery remains: with both RS-485 converters connected, the ESP refuses to join Wi-Fi. Remove one and everything works. So the second measuring point waits until I figure that one out.

## Future work

- Shrink the device to a single DIN position in the wiring cabinet
- Support two measuring locations (see above)
- Upgrade to [ESP32-S3-Zero](https://www.waveshare.com/wiki/ESP32-S3-Zero), which should lower consumption and save space in the box
- Let the device control the Shelly directly — the goal is to set the water levels from Home Assistant and have the device drive the pump on its own, even when Home Assistant is down
- A Home Assistant blueprint for device configuration

## References

1. https://community.home-assistant.io/t/water-level-sensor-qdy30a-modbus-rs485-with-esp32-s2-mini/698712
