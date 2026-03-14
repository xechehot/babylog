import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useProfile, formatAge } from "../hooks/useProfile";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const { profile, isLoaded, saveProfile, isSaving } = useProfile();

  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthWeight, setBirthWeight] = useState("");

  // Populate form when profile loads
  useEffect(() => {
    if (isLoaded) {
      setName(profile.baby_name ?? "");
      setBirthDate(profile.birth_date ?? "");
      setBirthWeight(profile.birth_weight ? String(profile.birth_weight) : "");
    }
  }, [isLoaded, profile]);

  const handleSave = async () => {
    await saveProfile({
      baby_name: name.trim() || null,
      birth_date: birthDate || null,
      birth_weight: birthWeight ? parseInt(birthWeight, 10) : null,
    });
    navigate({ to: "/" });
  };

  const age = formatAge(birthDate);

  if (!isLoaded) {
    return (
      <div className="p-4">
        <p className="text-gray-500">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate({ to: "/" })}
          className="p-2 -ml-2 text-gray-500 hover:text-gray-700"
          aria-label="Назад"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5 8.25 12l7.5-7.5"
            />
          </svg>
        </button>
        <h1 className="text-xl font-bold">Профиль</h1>
      </div>

      <div className="space-y-5">
        {/* Baby name */}
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Имя ребёнка
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Введите имя"
            className="w-full px-3 py-2.5 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        {/* Birth date */}
        <div>
          <label
            htmlFor="birthDate"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Дата рождения
          </label>
          <input
            type="date"
            id="birthDate"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="w-full px-3 py-2.5 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          {age && (
            <p className="mt-1.5 text-sm text-gray-500">Возраст: {age}</p>
          )}
        </div>

        {/* Birth weight */}
        <div>
          <label
            htmlFor="birthWeight"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Вес при рождении (г)
          </label>
          <div className="relative">
            <input
              type="number"
              id="birthWeight"
              value={birthWeight}
              onChange={(e) => setBirthWeight(e.target.value)}
              placeholder="3500"
              min="500"
              max="6000"
              step="10"
              className="w-full px-3 py-2.5 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none pr-10"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
              г
            </span>
          </div>
          {birthWeight && (
            <p className="mt-1.5 text-sm text-gray-500">
              {(parseInt(birthWeight, 10) / 1000).toFixed(2)} кг
            </p>
          )}
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50"
        >
          {isSaving ? "Сохранение..." : "Сохранить"}
        </button>
      </div>
    </div>
  );
}
