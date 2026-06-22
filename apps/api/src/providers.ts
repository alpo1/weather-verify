import { fetchOpenMeteoForecast } from "./openMeteo";
import { fetchWeatherApiForecast } from "./weatherApi";
import type { Location } from "./generated/prisma/client";
import { fetchGismeteoForecast } from "./gismeteo";

// Одна строка прогноза в общем формате (его возвращают ВСЕ адаптеры).
export type ForecastDay = {
    targetDate: string;
    tempMax: number | null;
    tempMin: number | null;
    precipMm: number | null;
};

// Сигнатура, которой обязан соответствовать любой адаптер прогноза.
export type ForecastFetcher = (location: Location) => Promise<ForecastDay[]>;

// Описание одного провайдера: его id (он же ляжет в Forecast.provider) и функция запроса.
export type Provider = {
    id: string;
    fetch: ForecastFetcher;
};

// Реестр — единственный источник правды о том, каких провайдеров мы собираем.
// Добавить нового = дописать сюда одну строку.
export const PROVIDERS: Provider[] = [
    { id: "open-meteo", fetch: fetchOpenMeteoForecast },
    { id: "weatherapi", fetch: fetchWeatherApiForecast },
    { id: "gismeteo",   fetch: fetchGismeteoForecast },
];