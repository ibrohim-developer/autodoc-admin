import { Navigate, useParams } from 'react-router'
import { DocumentEditor } from '@/components/content/document-editor'
import { SwitchField } from '@/components/content/fields'
import { MediaField } from '@/components/content/media-fields'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { type PageSpec, pageForm, pageSpec } from '../api/page-specs'
import { SeoFields } from '../components/seo-fields'

function PageSidebar({ spec }: { spec: PageSpec }) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Блоки</CardTitle>
          <CardDescription>
            Выключенный блок пропадает со страницы, его тексты остаются.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {spec.blocks.map((block) => (
            <SwitchField key={block.key} name={`shared.visible.${block.key}`} label={block.label} />
          ))}
        </CardContent>
      </Card>
      {spec.photos.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Главные фото</CardTitle>
            <CardDescription>
              Если фото не выбрано, на сайте остаётся фото из дизайна.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {spec.photos.map((photo) => (
              <MediaField key={photo.key} name={`shared.photos.${photo.key}`} label={photo.label} />
            ))}
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Для соцсетей</CardTitle>
          <CardDescription>Превью ссылки на эту страницу в Telegram и Facebook.</CardDescription>
        </CardHeader>
        <CardContent>
          <MediaField name="shared.ogImage" label="Картинка" />
        </CardContent>
      </Card>
    </>
  )
}

export function PageEditorPage() {
  const { key } = useParams()
  const spec = pageSpec(key)
  if (!spec) return <Navigate to="/pages" replace />
  const form = pageForm(spec)

  return (
    <DocumentEditor
      key={spec.key}
      type={`page_${spec.key}`}
      singleton
      showBack
      newTitle={`Страница «${spec.label}»`}
      list={{ path: '/pages', label: 'Страницы' }}
      permissions={{ write: 'content.write', publish: 'content.publish' }}
      titleName="title"
      empty={form.empty}
      fromData={form.fromData}
      toData={form.toData}
      hasLocale={form.hasLocale}
      // Every SEO field is optional: empty keeps what the page has now.
      uzbekRequired={false}
      renderLocale={({ locale }) => (
        <SeoFields
          locale={locale}
          titleHint="В заголовке вкладки и в поисковой выдаче. Если пусто — как сейчас на сайте."
          descriptionHint="Под заголовком в поисковой выдаче. Если пусто — как сейчас на сайте."
        />
      )}
      renderSidebar={() => <PageSidebar spec={spec} />}
    />
  )
}
