import Taro from "@tarojs/taro";

export interface CityWeather {
  location: string;
  text: string;
  temperatureC: number;
  warning: string;
  observedAt: string;
}

export async function loadCityWeather(province: string, city: string, district: string): Promise<CityWeather> {
  const baseUrl = (process.env.TARO_APP_WEATHER_API_BASE || "").trim();
  if (!baseUrl.startsWith("https://")) throw new Error("城市天气服务尚未配置");
  const location = [province, city, district].filter(Boolean).join(" ");
  if (!city.trim()) throw new Error("请先填写城市");
  const response = await Taro.request<CityWeather>({
    url: `${baseUrl.replace(/\/$/, "")}/weather`,
    method: "GET",
    data: { province, city, district }
  });
  if (response.statusCode !== 200 || !response.data?.observedAt) throw new Error("城市天气服务返回异常");
  return { ...response.data, location: response.data.location || location };
}
