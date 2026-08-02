import { Alert, Button, Modal, Select, Stack, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useEffect } from 'react'
import { TbInfoCircle } from 'react-icons/tb'

import { queryClient } from '@shared/api'
import { ACME_PROVIDER, AcmeCredentialSchema } from '@shared/api/contracts/acme.contract'
import { QueryKeys, useCreateAcmeCredential, useUpdateAcmeCredential } from '@shared/api/hooks'
import { z } from 'zod'

type Credential = z.infer<typeof AcmeCredentialSchema>

interface IProps {
    credential: Credential | null
    onClose: () => void
    opened: boolean
}

const PROVIDER_OPTIONS = [
    { label: 'ACME Proxy', value: ACME_PROVIDER.ACME_PROXY },
    { label: 'Cloudflare', value: ACME_PROVIDER.CLOUDFLARE },
    { label: 'Manual', value: ACME_PROVIDER.MANUAL }
]

const PROVIDER_HINTS: Record<string, string> = {
    [ACME_PROVIDER.ACME_PROXY]:
        'The proxy holds the DNS provider credentials and the domain policy. The panel keeps only this client token.',
    [ACME_PROVIDER.CLOUDFLARE]:
        'The token is stored in the panel and can edit every record in its zones. Convenient, but it puts a zone-wide credential in an internet-facing service.',
    [ACME_PROVIDER.MANUAL]:
        'Nothing is published automatically. Pairs with dns-persist-01, where one record is added by hand and renewals need no DNS access; it cannot answer dns-01.'
}

export const AcmeCredentialModalWidget = (props: IProps) => {
    const { credential, onClose, opened } = props

    const isEdit = credential !== null

    const createCredential = useCreateAcmeCredential({})
    const updateCredential = useUpdateAcmeCredential({})

    const form = useForm({
        initialValues: {
            apiToken: '',
            baseUrl: '',
            name: '',
            provider: ACME_PROVIDER.ACME_PROXY as string,
            token: ''
        },
        validate: {
            baseUrl: (value, values) =>
                values.provider === ACME_PROVIDER.ACME_PROXY && !value ? 'Base URL is required' : null,
            name: (value) => (value.trim().length < 2 ? 'Name is too short' : null),
            token: (value, values) =>
                values.provider === ACME_PROVIDER.ACME_PROXY && !isEdit && !value
                    ? 'Client token is required'
                    : null
        }
    })

    useEffect(() => {
        if (!opened) {
            return
        }

        form.setValues({
            apiToken: '',
            baseUrl: credential?.baseUrl ?? '',
            name: credential?.name ?? '',
            provider: credential?.provider ?? ACME_PROVIDER.ACME_PROXY,
            token: ''
        })
        form.resetDirty()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [opened, credential?.uuid])

    const invalidate = async () => {
        await queryClient.invalidateQueries({ queryKey: QueryKeys.acme.getCredentials.queryKey })
    }

    const handleSubmit = form.onSubmit(async (values) => {
        if (isEdit) {
            // Secrets are write-only: an empty field means "leave what is stored".
            await updateCredential.mutateAsync({
                variables: {
                    ...(values.apiToken ? { apiToken: values.apiToken } : {}),
                    ...(values.baseUrl ? { baseUrl: values.baseUrl } : {}),
                    ...(values.token ? { token: values.token } : {}),
                    name: values.name,
                    uuid: credential.uuid
                }
            })
        } else {
            await createCredential.mutateAsync({
                variables: {
                    ...(values.provider === ACME_PROVIDER.ACME_PROXY
                        ? { baseUrl: values.baseUrl, token: values.token }
                        : {}),
                    ...(values.provider === ACME_PROVIDER.CLOUDFLARE
                        ? { apiToken: values.apiToken }
                        : {}),
                    name: values.name,
                    provider: values.provider as never
                }
            })
        }

        await invalidate()
        onClose()
    })

    const provider = form.values.provider

    return (
        <Modal onClose={onClose} opened={opened} title={isEdit ? 'Edit credential' : 'New credential'}>
            <form onSubmit={handleSubmit}>
                <Stack gap="md">
                    <TextInput
                        label="Name"
                        placeholder="edge-proxy"
                        required
                        {...form.getInputProps('name')}
                    />

                    <Select
                        data={PROVIDER_OPTIONS}
                        disabled={isEdit}
                        description={
                            isEdit
                                ? 'The provider cannot be changed: the stored secret belongs to it. Create another credential instead.'
                                : undefined
                        }
                        label="Provider"
                        {...form.getInputProps('provider')}
                    />

                    <Alert color="gray" icon={<TbInfoCircle size={18} />} variant="light">
                        {PROVIDER_HINTS[provider]}
                    </Alert>

                    {provider === ACME_PROVIDER.ACME_PROXY && (
                        <>
                            <TextInput
                                label="Base URL"
                                placeholder="http://acme-proxy:8080"
                                required
                                {...form.getInputProps('baseUrl')}
                            />
                            <TextInput
                                description={
                                    isEdit ? 'Leave empty to keep the stored token' : undefined
                                }
                                label="Client token"
                                placeholder={isEdit ? '••••••••' : 'token issued by the proxy'}
                                {...form.getInputProps('token')}
                            />
                        </>
                    )}

                    {provider === ACME_PROVIDER.CLOUDFLARE && (
                        <TextInput
                            description={
                                isEdit
                                    ? 'Leave empty to keep the stored token'
                                    : 'Needs Zone:Read and DNS:Edit'
                            }
                            label="API token"
                            placeholder={isEdit ? '••••••••' : 'Cloudflare API token'}
                            {...form.getInputProps('apiToken')}
                        />
                    )}

                    <Button
                        loading={createCredential.isPending || updateCredential.isPending}
                        type="submit"
                    >
                        {isEdit ? 'Save' : 'Create'}
                    </Button>
                </Stack>
            </form>
        </Modal>
    )
}
