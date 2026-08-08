import { Button, Modal, Select, Stack, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useEffect } from 'react'
import { TbKey } from 'react-icons/tb'
import { z } from 'zod'

import { queryClient } from '@shared/api'
import { ACME_PROVIDER, AcmeCredentialSchema } from '@shared/api/contracts/acme.contract'
import { QueryKeys, useCreateAcmeCredential, useUpdateAcmeCredential } from '@shared/api/hooks'
import { ModalFooter } from '@shared/ui/modal-footer'
import { BaseOverlayHeader } from '@shared/ui/overlays/base-overlay-header'

type Credential = z.infer<typeof AcmeCredentialSchema>

interface IProps {
    credential: Credential | null
    onClose: () => void
    opened: boolean
}

// Every provider is configured the same way: pick a type, fill its fields.
const PROVIDER_OPTIONS = [
    { label: 'ACME Proxy', value: ACME_PROVIDER.ACME_PROXY },
    { label: 'Cloudflare', value: ACME_PROVIDER.CLOUDFLARE },
    { label: 'Manual', value: ACME_PROVIDER.MANUAL }
]

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
            provider: ACME_PROVIDER.CLOUDFLARE as string,
            token: ''
        },
        validate: {
            baseUrl: (value, values) =>
                values.provider === ACME_PROVIDER.ACME_PROXY && !value ? 'URL is required' : null,
            name: (value) => (value.trim().length < 2 ? 'Name is too short' : null),
            token: (value, values) =>
                values.provider === ACME_PROVIDER.ACME_PROXY && !isEdit && !value
                    ? 'Token is required'
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
            provider: credential?.provider ?? ACME_PROVIDER.CLOUDFLARE,
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
        <Modal
            centered
            onClose={onClose}
            opened={opened}
            title={
                <BaseOverlayHeader
                    iconColor="teal"
                    IconComponent={TbKey}
                    iconVariant="soft"
                    title={isEdit ? 'Edit credential' : 'New credential'}
                    titleOrder={5}
                />
            }
        >
            <form onSubmit={handleSubmit}>
                <Stack gap="md">
                    <TextInput
                        label="Name"
                        placeholder="my-dns-credential"
                        required
                        {...form.getInputProps('name')}
                    />

                    <Select
                        data={PROVIDER_OPTIONS}
                        description={
                            isEdit
                                ? 'The provider cannot be changed: the stored secret belongs to it. Create another credential instead.'
                                : undefined
                        }
                        disabled={isEdit}
                        label="Provider"
                        {...form.getInputProps('provider')}
                    />

                    {provider === ACME_PROVIDER.ACME_PROXY && (
                        <>
                            <TextInput
                                label="URL"
                                placeholder="http://acme-proxy:8080"
                                required
                                {...form.getInputProps('baseUrl')}
                            />
                            <TextInput
                                description={
                                    isEdit ? 'Leave empty to keep the stored token' : undefined
                                }
                                label="Token"
                                placeholder={isEdit ? '••••••••' : 'Client token'}
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
                </Stack>

                <ModalFooter>
                    <Button onClick={onClose} variant="subtle">
                        Cancel
                    </Button>
                    <Button
                        loading={createCredential.isPending || updateCredential.isPending}
                        type="submit"
                        variant="soft"
                    >
                        {isEdit ? 'Save' : 'Create'}
                    </Button>
                </ModalFooter>
            </form>
        </Modal>
    )
}
