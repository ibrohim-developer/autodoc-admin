import { Link } from 'react-router'
import { DocumentEditor } from '@/components/content/document-editor'
import { NumberField, TextField } from '@/components/content/fields'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { defaultSettings, settingsFromData, settingsToData } from '../api/settings-form'
import { MenuField } from '../components/menu-field'

function SettingsFields() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Контакты</CardTitle>
          <CardDescription>В меню, подвале и на странице «Контакты».</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <TextField name="shared.phone" label="Телефон" type="tel" required />
          <TextField name="shared.email" label="Email" type="email" required />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Соцсети</CardTitle>
          <CardDescription>Пустая ссылка — значок соцсети не показывается.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <TextField
            name="shared.socials.linkedin"
            label="LinkedIn"
            type="url"
            placeholder="https://www.linkedin.com/…"
          />
          <TextField
            name="shared.socials.instagram"
            label="Instagram"
            type="url"
            placeholder="https://www.instagram.com/…"
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Меню</CardTitle>
          <CardDescription>
            Порядок и видимость пунктов в меню и подвале. Названия пунктов — в{' '}
            <Link to="/texts" className="text-primary hover:underline">
              «Текстах сайта»
            </Link>{' '}
            → Меню.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MenuField name="shared.menu" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Счётчики и пиксели</CardTitle>
          <CardDescription>
            Сайт подключает их только после того, как посетитель согласится на cookies в баннере.
            Пустое поле — счётчик не используется. Собственная статистика админки работает и без
            них.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-3">
          <TextField
            name="shared.tracking.ga4"
            label="Google Analytics 4"
            placeholder="G-XXXXXXXXXX"
          />
          <TextField name="shared.tracking.metrica" label="Яндекс Метрика" placeholder="98765432" />
          <TextField
            name="shared.tracking.pixel"
            label="Meta Pixel"
            placeholder="1234567890123456"
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Офис на карте</CardTitle>
          <CardDescription>
            Точка на карте страницы «Контакты». Координаты можно скопировать из Яндекс или Google
            Карт: правый клик по месту.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <NumberField name="shared.map.lat" label="Широта" min={-90} max={90} step="any" />
          <NumberField name="shared.map.lon" label="Долгота" min={-180} max={180} step="any" />
        </CardContent>
      </Card>
    </div>
  )
}

export function SettingsPage() {
  return (
    <DocumentEditor
      type="site_settings"
      singleton
      publishOnSave
      newTitle="Настройки сайта"
      list={{ path: '/settings', label: 'Настройки сайта' }}
      permissions={{ write: 'content.write', publish: 'content.publish' }}
      titleName="title"
      empty={defaultSettings}
      fromData={settingsFromData}
      toData={settingsToData}
      // Settings are the same in every language.
      fieldOfIssue={(path) => path}
      renderShared={() => <SettingsFields />}
    />
  )
}
